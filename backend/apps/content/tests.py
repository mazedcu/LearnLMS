"""Tests for H5P uploads: validation, extraction, replacement and cleanup."""
import io
import json
import os
import shutil
import tempfile
import zipfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.content.models import ContentBlock
from apps.courses.models import Course, Module, Lesson

SAMPLE = os.path.join(os.path.dirname(__file__), 'test_data', 'true-false.h5p')
MEDIA = tempfile.mkdtemp(prefix='lms-test-media-')


def _zip(files):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return buf.getvalue()


def _upload(name, data):
    return SimpleUploadedFile(name, data, content_type='application/octet-stream')


@override_settings(MEDIA_ROOT=MEDIA)
class H5PUploadTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.admin = CustomUser.objects.create_user(email='a@x.com', username='a', password='pw', role='admin')
        course = Course.objects.create(title='C', slug='c', instructor=self.admin, status='published')
        mod = Module.objects.create(course=course, title='M', order=1)
        self.lesson = Lesson.objects.create(module=mod, title='L', order=1, is_published=True, is_preview=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = f'/api/content/lessons/{self.lesson.id}/blocks/'

    def post(self, name, data, **extra):
        return self.client.post(self.url, {'block_type': 'h5p', 'file': _upload(name, data), **extra}, format='multipart')

    def test_real_package_is_extracted_and_titled(self):
        with open(SAMPLE, 'rb') as fh:
            r = self.post('true-false.h5p', fh.read())
        self.assertEqual(r.status_code, 201, r.content)
        block = ContentBlock.objects.get()
        self.assertEqual(block.title, 'Hello World')  # taken from h5p.json
        root = os.path.join(MEDIA, block.h5p_extracted_path)
        self.assertTrue(os.path.exists(os.path.join(root, 'h5p.json')))
        self.assertTrue(os.path.isdir(os.path.join(root, 'H5P.TrueFalse-1.6')))

        # Students get the extracted path in the block data
        data = APIClient().get(self.url).json()
        blocks = data if isinstance(data, list) else data['results']
        self.assertEqual(blocks[0]['h5p_extracted_path'], block.h5p_extracted_path)

    def test_rejects_non_h5p_and_broken_packages(self):
        r = self.post('notes.pdf', b'%PDF-1.4')
        self.assertIn('.h5p', str(r.json()))
        r = self.post('bad.h5p', b'not a zip')
        self.assertIn("isn't a valid", str(r.json()))
        r = self.post('nometa.h5p', _zip({'content/content.json': '{}'}))
        self.assertIn('h5p.json is missing', str(r.json()))
        self.assertEqual(ContentBlock.objects.count(), 0)

    def test_rejects_package_without_libraries(self):
        meta = {'title': 'X', 'mainLibrary': 'H5P.TrueFalse',
                'preloadedDependencies': [{'machineName': 'H5P.TrueFalse', 'majorVersion': 1, 'minorVersion': 6}]}
        r = self.post('nolibs.h5p', _zip({'h5p.json': json.dumps(meta), 'content/content.json': '{}'}))
        self.assertEqual(r.status_code, 400)
        self.assertIn('libraries', str(r.json()))

    def test_replacing_file_reextracts_and_delete_cleans_up(self):
        with open(SAMPLE, 'rb') as fh:
            sample = fh.read()
        self.post('one.h5p', sample)
        block = ContentBlock.objects.get()
        root = os.path.join(MEDIA, block.h5p_extracted_path)
        marker = os.path.join(root, 'stale.txt')
        open(marker, 'w').write('old')

        r = self.client.patch(f'/api/content/blocks/{block.id}/', {'file': _upload('two.h5p', sample)}, format='multipart')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(os.path.exists(marker))  # fresh extraction replaced the old files
        self.assertTrue(os.path.exists(os.path.join(root, 'h5p.json')))

        self.client.delete(f'/api/content/blocks/{block.id}/')
        self.assertFalse(os.path.exists(root))

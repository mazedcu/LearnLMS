"""Video streaming: Python fallback in development, nginx hand-off in production."""
import shutil
import tempfile

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.media_library.models import VideoLibrary

MEDIA = tempfile.mkdtemp(prefix='lms-video-test-')


@override_settings(MEDIA_ROOT=MEDIA)
class StreamTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.video = VideoLibrary(title='Lecture 1')
        self.video.file.save('lecture 1.mp4', ContentFile(b'0123456789' * 100), save=True)
        self.url = f'/api/media/videos/{self.video.id}/stream/'

    def test_python_fallback_supports_ranges(self):
        r = APIClient().get(self.url, HTTP_RANGE='bytes=10-19')
        self.assertEqual(r.status_code, 206)
        self.assertEqual(b''.join(r.streaming_content), b'0123456789')
        self.assertEqual(r['Content-Type'], 'video/mp4')

    @override_settings(MEDIA_ACCEL_REDIRECT=True)
    def test_nginx_handoff_frees_the_worker(self):
        r = APIClient().get(self.url, HTTP_RANGE='bytes=0-')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.content, b'')  # nginx sends the bytes
        self.assertEqual(r['X-Accel-Redirect'], '/protected-media/' + self.video.file.name)
        self.assertTrue(self.video.file.name.startswith('media_library/lecture'))
        self.assertEqual(r['Content-Type'], 'video/mp4')

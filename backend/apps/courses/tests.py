"""Tests for the Course Builder endpoints."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.content.models import ContentBlock
from apps.courses.models import Course, Module, Lesson
from apps.dripping.models import DrippingRule


class CourseBuilderTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(
            email='a@x.com', username='a', password='pw', role='admin')
        self.student = CustomUser.objects.create_user(
            email='s@x.com', username='s', password='pw', role='student')
        self.course = Course.objects.create(title='Chem', slug='chem', instructor=self.admin, status='published')
        self.m1 = Module.objects.create(course=self.course, title='M1', order=1)
        self.m2 = Module.objects.create(course=self.course, title='M2', order=2)
        self.a = Lesson.objects.create(module=self.m1, title='A', order=1, is_published=True)
        self.b = Lesson.objects.create(module=self.m1, title='B', order=2, is_published=False)
        self.c = Lesson.objects.create(module=self.m2, title='C', order=1, is_published=True)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_outline_includes_drafts_counts_and_rules(self):
        ContentBlock.objects.create(lesson=self.a, block_type='html', html_content='x')
        DrippingRule.objects.create(lesson=self.c, criteria_type='completion', required_lesson=self.a)
        data = self.client.get('/api/courses/chem/outline/').json()
        self.assertEqual([m['title'] for m in data['modules']], ['M1', 'M2'])
        m1 = data['modules'][0]['lessons']
        self.assertEqual([l['title'] for l in m1], ['A', 'B'])
        self.assertEqual(m1[0]['block_count'], 1)
        rule = data['modules'][1]['lessons'][0]['drip_rule']
        self.assertEqual(rule['required_lesson'], str(self.a.id))

    def test_outline_forbidden_for_students(self):
        c = APIClient(); c.force_authenticate(self.student)
        self.assertEqual(c.get('/api/courses/chem/outline/').status_code, 403)

    def test_reorder_swaps_modules_and_moves_lesson_between_modules(self):
        r = self.client.post('/api/courses/chem/reorder/', {'modules': [
            {'id': str(self.m2.id), 'lessons': [str(self.c.id), str(self.b.id)]},
            {'id': str(self.m1.id), 'lessons': [str(self.a.id)]},
        ]}, format='json')
        self.assertEqual(r.status_code, 204)
        self.m1.refresh_from_db(); self.m2.refresh_from_db(); self.b.refresh_from_db()
        self.assertEqual((self.m2.order, self.m1.order), (1, 2))
        self.assertEqual((self.b.module_id, self.b.order), (self.m2.id, 2))

    def test_reorder_rejects_incomplete_list(self):
        r = self.client.post('/api/courses/chem/reorder/', {'modules': [
            {'id': str(self.m1.id), 'lessons': [str(self.a.id)]},
        ]}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_new_module_appends_even_after_deletion(self):
        self.m1.delete()
        r = self.client.post('/api/courses/chem/modules/', {'title': 'M3', 'order': 2}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Module.objects.get(title='M3').order, 3)

    def test_block_reorder_and_append(self):
        r1 = self.client.post(f'/api/content/lessons/{self.a.id}/blocks/', {'block_type': 'html', 'html_content': '1'}, format='json')
        r2 = self.client.post(f'/api/content/lessons/{self.a.id}/blocks/', {'block_type': 'html', 'html_content': '2'}, format='json')
        self.assertEqual(r1.status_code, 201)
        b1 = ContentBlock.objects.get(html_content='1'); b2 = ContentBlock.objects.get(html_content='2')
        self.assertEqual((b1.order, b2.order), (1, 2))
        r = self.client.post(f'/api/content/lessons/{self.a.id}/blocks/reorder/',
                             {'blocks': [str(b2.id), str(b1.id)]}, format='json')
        self.assertEqual(r.status_code, 204)
        b1.refresh_from_db(); b2.refresh_from_db()
        self.assertEqual((b1.order, b2.order), (2, 1))

    def test_lock_rule_can_be_removed(self):
        DrippingRule.objects.create(lesson=self.c, criteria_type='time', unlock_after_days=3)
        self.assertEqual(self.client.delete(f'/api/drip/rules/{self.c.id}/').status_code, 204)
        self.assertFalse(DrippingRule.objects.filter(lesson=self.c).exists())

    def test_students_do_not_see_draft_lessons_in_course(self):
        c = APIClient(); c.force_authenticate(self.student)
        titles = [l['title'] for m in c.get('/api/courses/chem/').json()['modules'] for l in m['lessons']]
        self.assertNotIn('B', titles)
        titles = [l['title'] for m in self.client.get('/api/courses/chem/').json()['modules'] for l in m['lessons']]
        self.assertIn('B', titles)

    def test_created_module_and_lesson_return_their_id(self):
        r = self.client.post('/api/courses/chem/modules/', {'title': 'M9'}, format='json')
        self.assertIn('id', r.json())
        r = self.client.post(f'/api/courses/modules/{self.m1.id}/lessons/', {'title': 'New'}, format='json')
        lesson = Lesson.objects.get(title='New')
        self.assertEqual(r.json()['id'], str(lesson.id))
        self.assertEqual(lesson.order, 3)  # appended after A and B

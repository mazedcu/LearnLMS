"""Tests for student lesson access, quiz answer hiding and quiz flow."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.assessments.models import Quiz, Question, QuizSubmission
from apps.content.models import ContentBlock
from apps.courses.models import Course, Module, Lesson, Enrollment
from apps.dripping.models import DrippingRule


class StudentAccessTests(TestCase):
    def setUp(self):
        self.teacher = CustomUser.objects.create_user(
            email='t@x.com', username='t', password='pw', role='instructor')
        self.student = CustomUser.objects.create_user(
            email='s@x.com', username='s', password='pw', role='student')
        self.outsider = CustomUser.objects.create_user(
            email='o@x.com', username='o', password='pw', role='student')

        self.course = Course.objects.create(
            title='Physics', slug='physics', instructor=self.teacher, status='published')
        mod = Module.objects.create(course=self.course, title='M1', order=1)
        self.l1 = Lesson.objects.create(module=mod, title='L1', order=1, is_published=True)
        self.l2 = Lesson.objects.create(module=mod, title='L2', order=2, is_published=True)
        self.draft = Lesson.objects.create(module=mod, title='Draft', order=3, is_published=False)
        DrippingRule.objects.create(lesson=self.l2, criteria_type='completion', required_lesson=self.l1)

        self.block1 = ContentBlock.objects.create(lesson=self.l1, block_type='html', html_content='<p>1</p>')
        self.block2 = ContentBlock.objects.create(lesson=self.l2, block_type='html', html_content='<p>2</p>')

        self.enrollment = Enrollment.objects.create(student=self.student, course=self.course)

        self.quiz = Quiz.objects.create(lesson=self.l1, title='Q', passing_score=50, max_attempts=2)
        Question.objects.create(
            quiz=self.quiz, question_type='mcq', prompt='2+2?', max_marks=1, order=1,
            content={'options': ['3', '4'], 'correct_answer': '4'})
        Question.objects.create(
            quiz=self.quiz, question_type='drag_drop_image', prompt='Place', max_marks=1, order=2,
            content={'background_url': '/bg.png', 'zones': [{'id': 'z1'}],
                     'items': [{'id': 'i1', 'label': 'A', 'correct_zone': 'z1'}]})
        Question.objects.create(
            quiz=self.quiz, question_type='calculated_mcq', prompt='{{a}}*2', max_marks=1, order=3,
            content={'formula': 'a*2', 'tolerance': 0.01, 'variables': {'a': {'min': 1, 'max': 5}}})

        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    # ── Content access ─────────────────────────────────────────────────────

    def test_single_block_blocked_for_non_enrolled(self):
        r = self.as_user(self.outsider).get(f'/api/content/blocks/{self.block1.id}/')
        self.assertEqual(r.status_code, 403)

    def test_single_block_blocked_while_drip_locked(self):
        r = self.as_user(self.student).get(f'/api/content/blocks/{self.block2.id}/')
        self.assertEqual(r.status_code, 403)

    def test_single_block_allowed_when_open(self):
        r = self.as_user(self.student).get(f'/api/content/blocks/{self.block1.id}/')
        self.assertEqual(r.status_code, 200)

    def test_unpublished_lesson_hidden_from_students(self):
        r = self.as_user(self.student).get(f'/api/content/lessons/{self.draft.id}/blocks/')
        self.assertEqual(r.json() if isinstance(r.json(), list) else r.json().get('results'), [])

    def test_expired_enrollment_has_no_access(self):
        self.enrollment.expiry_date = timezone.now() - timedelta(days=1)
        self.enrollment.save()
        r = self.as_user(self.student).get(f'/api/content/blocks/{self.block1.id}/')
        self.assertEqual(r.status_code, 403)

    def test_lesson_status_explains_lock_and_updates_on_completion(self):
        c = self.as_user(self.student)
        data = c.get('/api/content/courses/physics/lesson-status/').json()
        l2 = data['lessons'][str(self.l2.id)]
        self.assertFalse(l2['accessible'])
        self.assertEqual(l2['lock']['reason'], 'completion')
        self.assertIn('L1', l2['lock']['message'])
        self.assertNotIn(str(self.draft.id), data['lessons'])

        self.assertEqual(c.post(f'/api/content/lessons/{self.l1.id}/complete/').status_code, 200)
        data = c.get('/api/content/courses/physics/lesson-status/').json()
        self.assertTrue(data['lessons'][str(self.l1.id)]['completed'])
        self.assertTrue(data['lessons'][str(self.l2.id)]['accessible'])

    def test_lesson_status_anonymous(self):
        data = APIClient().get('/api/content/courses/physics/lesson-status/').json()
        self.assertEqual(data['lessons'][str(self.l1.id)]['lock']['reason'], 'login')

    # ── Quiz answers ───────────────────────────────────────────────────────

    def test_student_quiz_list_has_no_answer_keys(self):
        r = self.as_user(self.student).get(f'/api/assessments/lessons/{self.l1.id}/quizzes/')
        self.assertEqual(r.status_code, 200)
        body = str(r.json())
        for secret in ('correct_answer', 'correct_zone', 'formula', 'tolerance'):
            self.assertNotIn(secret, body)
        quiz = r.json()[0] if isinstance(r.json(), list) else r.json()['results'][0]
        self.assertEqual(quiz['attempts_left'], 2)
        mcq = next(q for q in quiz['questions'] if q['question_type'] == 'mcq')
        self.assertEqual(mcq['content']['options'], ['3', '4'])

    def test_editor_still_gets_answer_keys(self):
        r = self.as_user(self.teacher).get(f'/api/assessments/lessons/{self.l1.id}/quizzes/')
        self.assertIn('correct_answer', str(r.json()))

    def test_outsider_cannot_list_or_start_quiz(self):
        c = self.as_user(self.outsider)
        self.assertEqual(c.get(f'/api/assessments/lessons/{self.l1.id}/quizzes/').status_code, 403)
        self.assertEqual(c.post(f'/api/assessments/quizzes/{self.quiz.id}/start/').status_code, 403)

    # ── Quiz flow ──────────────────────────────────────────────────────────

    def test_quiz_flow_hides_marks_and_reports_result(self):
        c = self.as_user(self.student)
        sub = c.post(f'/api/assessments/quizzes/{self.quiz.id}/start/').json()

        # Restarting resumes the same attempt instead of using another
        again = c.post(f'/api/assessments/quizzes/{self.quiz.id}/start/').json()
        self.assertEqual(sub['id'], again['id'])

        mcq = self.quiz.questions.get(question_type='mcq')
        r = c.post(f'/api/assessments/submissions/{sub["id"]}/submit/{mcq.id}/',
                   {'answer_data': {'answer': '4'}}, format='json')
        self.assertEqual(r.json(), {'question': str(mcq.id), 'saved': True})

        result = c.post(f'/api/assessments/submissions/{sub["id"]}/finish/').json()
        self.assertEqual(result['passing_score'], 50)
        self.assertFalse(result['passed'])  # 1 of 3 marks
        self.assertEqual(result['attempts_left'], 1)
        self.assertEqual(QuizSubmission.objects.filter(student=self.student).count(), 1)

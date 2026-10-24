"""Quiz behaviour: every question type marks correctly, calculated
multichoice options, fair blank marking, timed attempts, saved answers and
per-question results."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.assessments.models import Quiz, Question, QuizSubmission
from apps.assessments.serializers import calc_options, mark_question, _safe_eval
from apps.courses.models import Course, Module, Lesson, Enrollment


class MarkingTests(TestCase):
    def q(self, qtype, content, marks=1):
        return Question(question_type=qtype, content=content, max_marks=marks)

    def test_fill_blanks_forgives_case_spaces_punctuation_and_alternatives(self):
        q = self.q('fill_blanks', {'blanks': {'blank1': 'Paris', 'blank2': 'colour|color'}}, 2)
        self.assertEqual(mark_question(q, {'blanks': {'blank1': '  paris. ', 'blank2': 'Color'}})[0], 2)
        self.assertEqual(mark_question(q, {'blanks': {'blank1': 'Lyon', 'blank2': 'colour'}})[0], 1)

    def test_calc_options_contain_the_right_answer_once(self):
        content = {'formula': 'a*b', 'tolerance': 0.01, 'distractors': ['a+b', 'a*b+1', 'a*b']}
        opts = calc_options(content, {'a': 3, 'b': 7}, seed=1)
        self.assertEqual(sorted(opts), [10, 21, 22])  # duplicate of the answer dropped
        self.assertEqual(calc_options({'formula': 'a*b'}, {'a': 3, 'b': 7}), [])  # no distractors → typed answer

    def test_chosen_calc_option_is_marked_right(self):
        content = {'formula': 'a/b', 'tolerance': 0.01, 'distractors': ['a*b']}
        variables = {'a': 1, 'b': 3}
        opts = calc_options(content, variables, seed=2)
        right = min(opts, key=lambda v: abs(v - _safe_eval('a/b', variables)))
        q = self.q('calculated_mcq', content)
        self.assertEqual(mark_question(q, {'answer': right}, variables)[0], 1)


class QuizFlowTests(TestCase):
    def setUp(self):
        admin = CustomUser.objects.create_user(email='a@x.com', username='a', password='pw', role='admin')
        self.student = CustomUser.objects.create_user(email='s@x.com', username='s', password='pw', role='student')
        course = Course.objects.create(title='C', slug='c', instructor=admin, status='published')
        lesson = Lesson.objects.create(module=Module.objects.create(course=course, title='M', order=1),
                                       title='L', order=1, is_published=True)
        Enrollment.objects.create(student=self.student, course=course)
        self.quiz = Quiz.objects.create(lesson=lesson, title='Q', passing_score=50, time_limit_mins=10)
        self.mcq = Question.objects.create(quiz=self.quiz, question_type='mcq', prompt='2+2?', max_marks=1, order=1,
                                           content={'options': ['3', '4'], 'correct_answer': '4'})
        self.calc = Question.objects.create(quiz=self.quiz, question_type='calculated_mcq', prompt='{{a}}*{{b}}', max_marks=1, order=2,
                                            content={'variables': {'a': {'min': 2, 'max': 9}, 'b': {'min': 2, 'max': 9}},
                                                     'formula': 'a*b', 'tolerance': 0.01, 'distractors': ['a+b']})
        self.c = APIClient(); self.c.force_authenticate(self.student)

    def start(self):
        sub = self.c.post(f'/api/assessments/quizzes/{self.quiz.id}/start/').json()
        rendered = self.c.get(f"/api/assessments/submissions/{sub['id']}/questions/").json()
        return sub, rendered

    def test_calc_question_gets_options_and_right_one_scores(self):
        sub, rendered = self.start()
        data = rendered['rendered_questions'][str(self.calc.id)]
        v = data['variables']
        self.assertIn(v['a'] * v['b'], data['options'])
        self.assertNotIn('formula', str(rendered))
        self.c.post(f"/api/assessments/submissions/{sub['id']}/submit/{self.calc.id}/",
                    {'answer_data': {'answer': v['a'] * v['b']}}, format='json')
        result = self.c.post(f"/api/assessments/submissions/{sub['id']}/finish/").json()
        self.assertEqual(result['score'], 1)

    def test_saved_answers_and_time_survive_a_reload(self):
        sub, _ = self.start()
        self.assertTrue(0 < sub['seconds_left'] <= 600)
        self.c.post(f"/api/assessments/submissions/{sub['id']}/submit/{self.mcq.id}/",
                    {'answer_data': {'answer': '4'}}, format='json')
        again, rendered = self.start()  # page reload resumes the same attempt
        self.assertEqual(again['id'], sub['id'])
        self.assertEqual(rendered['answers'][str(self.mcq.id)], {'answer': '4'})

    def test_answers_after_time_runs_out_are_refused(self):
        sub, _ = self.start()
        QuizSubmission.objects.filter(pk=sub['id']).update(started_at=timezone.now() - timedelta(minutes=13))
        r = self.c.post(f"/api/assessments/submissions/{sub['id']}/submit/{self.mcq.id}/",
                        {'answer_data': {'answer': '4'}}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Time is up', r.json()['detail'])

    def test_result_lists_each_question_without_answers(self):
        sub, _ = self.start()
        self.c.post(f"/api/assessments/submissions/{sub['id']}/submit/{self.mcq.id}/",
                    {'answer_data': {'answer': '4'}}, format='json')
        result = self.c.post(f"/api/assessments/submissions/{sub['id']}/finish/").json()
        self.assertEqual([(r['number'], r['marks'], r['answered']) for r in result['results']], [(1, 1.0, True), (2, 0.0, False)])
        self.assertNotIn('correct_answer', str(result))

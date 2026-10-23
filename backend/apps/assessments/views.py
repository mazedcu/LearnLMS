from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
import random
from .models import Quiz, Question, QuizSubmission, QuestionResponse
from apps.common.access import check_lesson_access, is_course_staff
from rest_framework.exceptions import PermissionDenied
from .serializers import (
    QuizSerializer, QuestionSerializer, StudentQuizSerializer,
    QuizSubmissionSerializer, QuestionResponseSerializer,
    mark_question, generate_calc_variables, interpolate_prompt
)

class StartQuizView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, quiz_pk):
        quiz = get_object_or_404(
            Quiz.objects.select_related('lesson__module__course'), pk=quiz_pk, is_active=True
        )
        _, allowed = check_lesson_access(request.user, quiz.lesson)
        if not allowed:
            raise PermissionDenied('You do not have access to this lesson.')

        # Resume an unfinished attempt (e.g. after a page reload) rather than
        # starting a new one and using up another attempt.
        existing = QuizSubmission.objects.filter(
            student=request.user, quiz=quiz, status=QuizSubmission.Status.IN_PROGRESS
        ).first()
        if existing:
            return Response(QuizSubmissionSerializer(existing).data, status=status.HTTP_200_OK)

        # Check attempts
        if quiz.max_attempts > 0:
            attempt_count = QuizSubmission.objects.filter(
                student=request.user, quiz=quiz
            ).count()
            if attempt_count >= quiz.max_attempts:
                return Response(
                    {'detail': f'Maximum {quiz.max_attempts} attempt(s) allowed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Pre-generate per-question state (calc-MCQ variables, interpolated prompts)
        rendered = {}
        seed = random.randint(1, 1_000_000)  # per-attempt seed
        for question in quiz.questions.filter(is_active=True):
            q_id = str(question.id)
            data = {}
            if question.question_type == Question.Type.CALCULATED_MCQ:
                variables = generate_calc_variables(question.content, seed)
                data['variables'] = variables
                data['interpolated_prompt'] = interpolate_prompt(question.prompt, variables)
            rendered[q_id] = data

        submission = QuizSubmission.objects.create(
            student=request.user,
            quiz=quiz,
            status=QuizSubmission.Status.IN_PROGRESS,
            rendered_questions=rendered,
        )
        return Response(QuizSubmissionSerializer(submission).data, status=status.HTTP_201_CREATED)

class SubmitAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, submission_pk, question_pk):
        submission = get_object_or_404(QuizSubmission, pk=submission_pk, student=request.user,
                                        status=QuizSubmission.Status.IN_PROGRESS)
        question = get_object_or_404(Question, pk=question_pk, quiz=submission.quiz, is_active=True)

        answer_data = request.data.get('answer_data', {})

        # For calc-MCQ, use the pre-generated variables stored on the submission
        rendered = submission.rendered_questions.get(str(question.id), {})
        rendered_variables = rendered.get('variables') if isinstance(rendered, dict) else None

        marks, feedback = mark_question(question, answer_data, rendered_variables)

        response, _ = QuestionResponse.objects.update_or_create(
            submission=submission,
            question=question,
            defaults={
                'answer_data': answer_data,
                'marks_obtained': marks,
                'feedback': feedback
            }
        )

        # Marks and feedback stay server-side until the quiz is finished;
        # returning them here would let a student resubmit until correct.
        return Response({'question': str(question.id), 'saved': True})

class FinishQuizView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, submission_pk):
        submission = get_object_or_404(QuizSubmission, pk=submission_pk, student=request.user,
                                        status=QuizSubmission.Status.IN_PROGRESS)
        
        # Finalize submission
        submission.status = QuizSubmission.Status.SUBMITTED
        submission.finished_at = timezone.now()
        
        # Calculate total score
        total_marks = 0
        total_obtained = 0
        
        for question in submission.quiz.questions.filter(is_active=True):
            total_marks += question.max_marks
            resp = QuestionResponse.objects.filter(submission=submission, question=question).first()
            if resp:
                total_obtained += resp.marks_obtained
        
        submission.total_marks = total_marks
        submission.score = total_obtained
        submission.save()

        quiz = submission.quiz
        data = QuizSubmissionSerializer(submission).data
        data['passing_score'] = quiz.passing_score
        data['passed'] = submission.score_percent >= quiz.passing_score
        if quiz.max_attempts:
            used = QuizSubmission.objects.filter(student=request.user, quiz=quiz).count()
            data['attempts_left'] = max(quiz.max_attempts - used, 0)
        else:
            data['attempts_left'] = None

        # A finished quiz can unlock quiz-score drip rules.
        from apps.common.access import active_enrollment
        enrollment = active_enrollment(request.user, quiz.lesson.module.course)
        if enrollment:
            from apps.dripping.services import DrippingService
            DrippingService(enrollment).unlock_all_eligible()

        return Response(data)

class SubmissionDetailView(generics.RetrieveAPIView):
    serializer_class = QuizSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = QuizSubmission.objects.all()

    def get_queryset(self):
        return super().get_queryset().filter(student=self.request.user)


class RenderedQuestionsView(APIView):
    """Return the pre-generated per-question state (interpolated prompts,
    variables, etc.) for an in-progress submission."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, submission_pk):
        submission = get_object_or_404(
            QuizSubmission,
            pk=submission_pk,
            student=request.user,
            status=QuizSubmission.Status.IN_PROGRESS
        )
        return Response({
            'rendered_questions': submission.rendered_questions,
        })


# ── Admin CRUD Views ────────────────────────────────────────────────────────

class IsAdminOrInstructor(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and (
            request.user.is_staff or getattr(request.user, 'role', '') in ('admin', 'instructor')
        )

class QuizCreateView(generics.ListCreateAPIView):
    """List quizzes for a lesson, or create one.

    GET  — staff (admin/manager/course instructor) get full questions with
           answer keys for the editor; students with access to the lesson get
           active quizzes with answer keys removed.
    POST — admin/instructor only.
    """

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsAdminOrInstructor()]

    def _lesson(self):
        if not hasattr(self, '_lesson_cache'):
            from apps.courses.models import Lesson
            self._lesson_cache = get_object_or_404(
                Lesson.objects.select_related('module__course'), pk=self.kwargs['lesson_pk']
            )
        return self._lesson_cache

    def _is_editor(self):
        user = self.request.user
        lesson = self._lesson()
        return is_course_staff(user, lesson.module.course) or getattr(user, 'role', '') == 'instructor'

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self._is_editor():
            return StudentQuizSerializer
        return QuizSerializer

    def get_queryset(self):
        lesson = self._lesson()
        if self._is_editor():
            return Quiz.objects.filter(lesson=lesson).order_by('created_at')
        _, allowed = check_lesson_access(self.request.user, lesson)
        if not allowed:
            raise PermissionDenied('You do not have access to this lesson.')
        return Quiz.objects.filter(lesson=lesson, is_active=True).order_by('created_at')

    def perform_create(self, serializer):
        serializer.save(lesson_id=self.kwargs['lesson_pk'])

class QuizDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Update or delete a quiz (admin/instructor)."""
    serializer_class = QuizSerializer
    permission_classes = [IsAdminOrInstructor]
    queryset = Quiz.objects.all()
    lookup_url_kwarg = 'quiz_pk'

class QuestionListCreateView(generics.ListCreateAPIView):
    """List or create questions for a quiz (admin/instructor)."""
    serializer_class = QuestionSerializer
    permission_classes = [IsAdminOrInstructor]

    def get_queryset(self):
        return Question.objects.filter(quiz_id=self.kwargs['quiz_pk'])

    def perform_create(self, serializer):
        serializer.save(quiz_id=self.kwargs['quiz_pk'])

class QuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Update or delete a question (admin/instructor)."""
    serializer_class = QuestionSerializer
    permission_classes = [IsAdminOrInstructor]
    queryset = Question.objects.all()
    lookup_url_kwarg = 'question_pk'

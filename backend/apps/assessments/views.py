from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
import random
from .models import Quiz, Question, QuizSubmission, QuestionResponse
from .serializers import (
    QuizSerializer, QuestionSerializer,
    QuizSubmissionSerializer, QuestionResponseSerializer,
    mark_question, generate_calc_variables, interpolate_prompt
)

class QuizListView(generics.ListAPIView):
    serializer_class = QuizSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        lesson_pk = self.kwargs.get('lesson_pk')
        return Quiz.objects.filter(lesson_id=lesson_pk, is_active=True)

class StartQuizView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, quiz_pk):
        quiz = get_object_or_404(Quiz, pk=quiz_pk, is_active=True)

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
        question = get_object_or_404(Question, pk=question_pk, quiz=submission.quiz)

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

        return Response(QuestionResponseSerializer(response).data)

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
        
        for question in submission.quiz.questions.all():
            total_marks += question.max_marks
            resp = QuestionResponse.objects.filter(submission=submission, question=question).first()
            if resp:
                total_obtained += resp.marks_obtained
        
        submission.total_marks = total_marks
        submission.score = total_obtained
        submission.save()
        
        return Response(QuizSubmissionSerializer(submission).data)

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
    """List or create quizzes for a lesson (admin/instructor)."""
    serializer_class = QuizSerializer
    permission_classes = [IsAdminOrInstructor]

    def get_queryset(self):
        return Quiz.objects.filter(lesson_id=self.kwargs['lesson_pk'])

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

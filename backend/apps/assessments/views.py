from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.common.permissions import IsInstructorOrAdmin
from .models import AIQuestion, AISubmission, MoodleQuiz, QuizAttempt
from .serializers import (
    AIQuestionSerializer, AIQuestionAdminSerializer,
    AISubmissionSerializer, SubmitAnswerSerializer, OverrideScoreSerializer,
    MoodleQuizSerializer, QuizAttemptSerializer,
)
from .ai_service import get_ai_marking_service
from .moodle_client import get_moodle_client


# ─── AI Questions ─────────────────────────────────────────────────────────────

class AIQuestionListView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsInstructorOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == 'POST' or self.request.user.role in ('instructor', 'admin'):
            return AIQuestionAdminSerializer
        return AIQuestionSerializer

    def get_queryset(self):
        lesson_pk = self.kwargs.get('lesson_pk')
        return AIQuestion.objects.filter(lesson_id=lesson_pk, is_active=True).order_by('order')


class SubmitAnswerView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, question_pk):
        question = get_object_or_404(AIQuestion, pk=question_pk, is_active=True)
        serializer = SubmitAnswerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answer_text = serializer.validated_data['answer_text']

        # Prevent re-submission if already marked (allow instructor override separately)
        existing = AISubmission.objects.filter(student=request.user, question=question).first()
        if existing and existing.is_reviewed:
            return Response(
                {'detail': 'Already reviewed by instructor.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Call AI marking service (mock or real)
        service = get_ai_marking_service()
        result  = service.mark(question, answer_text)

        submission, _ = AISubmission.objects.update_or_create(
            student=request.user,
            question=question,
            defaults={
                'answer_text': answer_text,
                'ai_score': result.get('score', 0),
                'ai_feedback': result.get('feedback', ''),
                'ai_breakdown': result.get('breakdown', []),
                'ai_raw_response': result,
                'ai_evaluated_at': timezone.now(),
            },
        )
        return Response(AISubmissionSerializer(submission).data, status=status.HTTP_200_OK)


class OverrideSubmissionView(APIView):
    permission_classes = [IsInstructorOrAdmin]

    def patch(self, request, pk):
        submission = get_object_or_404(AISubmission, pk=pk)
        serializer = OverrideScoreSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if serializer.validated_data['teacher_score'] > submission.question.max_marks:
            return Response(
                {'detail': f'Score cannot exceed {submission.question.max_marks}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        submission.teacher_score    = serializer.validated_data['teacher_score']
        submission.teacher_feedback = serializer.validated_data['teacher_feedback']
        submission.is_reviewed      = True
        submission.reviewed_by      = request.user
        submission.reviewed_at      = timezone.now()
        submission.save()
        return Response(AISubmissionSerializer(submission).data)


class MySubmissionsView(generics.ListAPIView):
    serializer_class = AISubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AISubmission.objects.filter(
            student=self.request.user,
            question__lesson_id=self.kwargs['lesson_pk'],
        )


# ─── Moodle Quiz Proxy ────────────────────────────────────────────────────────

class MoodleQuizInfoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        quiz = get_object_or_404(MoodleQuiz, pk=pk, is_active=True)
        client = get_moodle_client()
        try:
            moodle_data = client.get_quiz_info(quiz.moodle_quiz_id)
        except Exception as e:
            moodle_data = {}
        data = MoodleQuizSerializer(quiz).data
        data['moodle_info'] = moodle_data
        return Response(data)


class StartAttemptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        quiz = get_object_or_404(MoodleQuiz, pk=pk, is_active=True)

        # Check attempt limit
        attempt_count = QuizAttempt.objects.filter(
            student=request.user, moodle_quiz=quiz
        ).count()
        if attempt_count >= quiz.max_attempts:
            return Response(
                {'detail': f'Maximum {quiz.max_attempts} attempt(s) allowed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client = get_moodle_client()
        try:
            moodle_resp = client.start_attempt(quiz.moodle_quiz_id)
            moodle_attempt_id = moodle_resp.get('attempt', {}).get('id')
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        attempt = QuizAttempt.objects.create(
            student=request.user,
            moodle_quiz=quiz,
            moodle_attempt_id=moodle_attempt_id,
            status=QuizAttempt.Status.IN_PROGRESS,
        )
        return Response(QuizAttemptSerializer(attempt).data, status=status.HTTP_201_CREATED)


class GetAttemptDataView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, attempt_pk):
        attempt = get_object_or_404(QuizAttempt, pk=attempt_pk, student=request.user)
        page = int(request.query_params.get('page', 0))
        client = get_moodle_client()
        try:
            data = client.get_attempt_data(attempt.moodle_attempt_id, page)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(data)


class SubmitAttemptView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, attempt_pk):
        attempt = get_object_or_404(QuizAttempt, pk=attempt_pk, student=request.user,
                                    status=QuizAttempt.Status.IN_PROGRESS)
        answers = request.data.get('answers', [])
        finish  = request.data.get('finish', True)

        client = get_moodle_client()
        try:
            client.process_attempt(attempt.moodle_attempt_id, answers, finish=finish)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        if finish:
            attempt.status      = QuizAttempt.Status.FINISHED
            attempt.finished_at = timezone.now()
            # Fetch result from Moodle
            try:
                review = client.get_attempt_review(attempt.moodle_attempt_id)
                attempt_data = review.get('attempt', {})
                attempt.score     = attempt_data.get('sumgrades', 0)
                attempt.max_score = attempt_data.get('maxgrade', 0)
            except Exception:
                pass
            attempt.save()

        return Response(QuizAttemptSerializer(attempt).data)


class AttemptReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk, attempt_pk):
        attempt = get_object_or_404(QuizAttempt, pk=attempt_pk, student=request.user)
        client = get_moodle_client()
        try:
            data = client.get_attempt_review(attempt.moodle_attempt_id)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_502_BAD_GATEWAY)
        data['local_attempt'] = QuizAttemptSerializer(attempt).data
        return Response(data)

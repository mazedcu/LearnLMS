from django.urls import path
from .views import (
    AIQuestionListView, SubmitAnswerView, OverrideSubmissionView, MySubmissionsView,
    MoodleQuizInfoView, StartAttemptView, GetAttemptDataView, SubmitAttemptView, AttemptReviewView,
)

app_name = 'assessments'

urlpatterns = [
    # AI Q&A
    path('lessons/<uuid:lesson_pk>/questions/', AIQuestionListView.as_view(), name='question-list'),
    path('lessons/<uuid:lesson_pk>/submissions/', MySubmissionsView.as_view(), name='my-submissions'),
    path('questions/<uuid:question_pk>/submit/', SubmitAnswerView.as_view(), name='submit-answer'),
    path('submissions/<uuid:pk>/override/', OverrideSubmissionView.as_view(), name='override'),

    # Moodle Quiz
    path('quizzes/<uuid:pk>/', MoodleQuizInfoView.as_view(), name='quiz-info'),
    path('quizzes/<uuid:pk>/start/', StartAttemptView.as_view(), name='start-attempt'),
    path('quizzes/<uuid:pk>/attempts/<uuid:attempt_pk>/', GetAttemptDataView.as_view(), name='attempt-data'),
    path('quizzes/<uuid:pk>/attempts/<uuid:attempt_pk>/submit/', SubmitAttemptView.as_view(), name='submit-attempt'),
    path('quizzes/<uuid:pk>/attempts/<uuid:attempt_pk>/review/', AttemptReviewView.as_view(), name='review'),
]

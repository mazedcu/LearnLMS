from django.urls import path
from .views import (
    AIQuestionListView, AIQuestionDetailView,
    SubmitAnswerView, OverrideSubmissionView, MySubmissionsView,
    MoodleQuizLessonView, MoodleQuizDetailView,
    MoodleQuizInfoView, StartAttemptView, GetAttemptDataView, SubmitAttemptView, AttemptReviewView,
)

app_name = 'assessments'

urlpatterns = [
    # AI Q&A
    path('lessons/<uuid:lesson_pk>/questions/', AIQuestionListView.as_view(), name='question-list'),
    path('questions/<uuid:pk>/', AIQuestionDetailView.as_view(), name='question-detail'),
    path('lessons/<uuid:lesson_pk>/submissions/', MySubmissionsView.as_view(), name='my-submissions'),
    path('questions/<uuid:question_pk>/submit/', SubmitAnswerView.as_view(), name='submit-answer'),
    path('submissions/<uuid:pk>/override/', OverrideSubmissionView.as_view(), name='override'),

    # Moodle Quiz (Admin CRUD)
    path('lessons/<uuid:lesson_pk>/quizzes/', MoodleQuizLessonView.as_view(), name='quiz-lesson-list'),
    path('quizzes/<uuid:pk>/', MoodleQuizDetailView.as_view(), name='quiz-detail'),

    # Moodle Quiz (Student flow)
    path('quizzes/<uuid:pk>/info/', MoodleQuizInfoView.as_view(), name='quiz-info'),
    path('quizzes/<uuid:pk>/start/', StartAttemptView.as_view(), name='start-attempt'),
    path('quizzes/<uuid:pk>/attempts/<uuid:attempt_pk>/', GetAttemptDataView.as_view(), name='attempt-data'),
    path('quizzes/<uuid:pk>/attempts/<uuid:attempt_pk>/submit/', SubmitAttemptView.as_view(), name='submit-attempt'),
    path('quizzes/<uuid:pk>/attempts/<uuid:attempt_pk>/review/', AttemptReviewView.as_view(), name='review'),
]

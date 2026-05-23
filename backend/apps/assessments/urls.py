from django.urls import path
from .views import (
    QuizListView, StartQuizView, SubmitAnswerView,
    FinishQuizView, SubmissionDetailView, RenderedQuestionsView,
    QuizCreateView, QuizDetailView,
    QuestionListCreateView, QuestionDetailView,
)

app_name = 'assessments'

urlpatterns = [
    # Lesson-level quiz list (students see active only)
    path('lessons/<uuid:lesson_pk>/quizzes/', QuizCreateView.as_view(), name='quiz-list-create'),
    
    # Quiz CRUD (admin/instructor)
    path('quizzes/<uuid:quiz_pk>/', QuizDetailView.as_view(), name='quiz-detail'),
    
    # Question CRUD (admin/instructor)
    path('quizzes/<uuid:quiz_pk>/questions/', QuestionListCreateView.as_view(), name='question-list-create'),
    path('questions/<uuid:question_pk>/', QuestionDetailView.as_view(), name='question-detail'),
    
    # Quiz interaction (students)
    path('quizzes/<uuid:quiz_pk>/start/', StartQuizView.as_view(), name='quiz-start'),
    path('submissions/<uuid:submission_pk>/questions/', RenderedQuestionsView.as_view(), name='rendered-questions'),
    path('submissions/<uuid:submission_pk>/submit/<uuid:question_pk>/', SubmitAnswerView.as_view(), name='submit-answer'),
    path('submissions/<uuid:submission_pk>/finish/', FinishQuizView.as_view(), name='quiz-finish'),

    # Submission review
    path('submissions/<uuid:pk>/', SubmissionDetailView.as_view(), name='submission-detail'),
]

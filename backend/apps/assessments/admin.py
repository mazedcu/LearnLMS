from django.contrib import admin
from .models import AIQuestion, AISubmission, MoodleQuiz, QuizAttempt


@admin.register(AIQuestion)
class AIQuestionAdmin(admin.ModelAdmin):
    list_display  = ['question_text', 'lesson', 'max_marks', 'is_active', 'order']
    list_filter   = ['is_active']
    search_fields = ['question_text', 'lesson__title']


@admin.register(AISubmission)
class AISubmissionAdmin(admin.ModelAdmin):
    list_display  = ['student', 'question', 'ai_score', 'teacher_score', 'is_reviewed', 'submitted_at']
    list_filter   = ['is_reviewed']
    search_fields = ['student__email']
    readonly_fields = ['ai_raw_response', 'ai_evaluated_at', 'submitted_at']


@admin.register(MoodleQuiz)
class MoodleQuizAdmin(admin.ModelAdmin):
    list_display  = ['title', 'lesson', 'moodle_quiz_id', 'max_attempts', 'is_active']
    list_filter   = ['is_active']


@admin.register(QuizAttempt)
class QuizAttemptAdmin(admin.ModelAdmin):
    list_display  = ['student', 'moodle_quiz', 'score', 'max_score', 'status', 'started_at']
    list_filter   = ['status']
    search_fields = ['student__email']
    readonly_fields = ['started_at', 'finished_at']

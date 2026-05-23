from django.contrib import admin
from .models import Quiz, Question, QuizSubmission, QuestionResponse

class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ['title', 'lesson', 'passing_score', 'max_attempts', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['title', 'lesson__title']
    inlines = [QuestionInline]

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['prompt', 'quiz', 'question_type', 'max_marks', 'order', 'is_active']
    list_filter = ['question_type', 'is_active']
    search_fields = ['prompt', 'quiz__title']

@admin.register(QuizSubmission)
class QuizSubmissionAdmin(admin.ModelAdmin):
    list_display = ['student', 'quiz', 'score', 'total_marks', 'status', 'started_at', 'finished_at']
    list_filter = ['status', 'started_at']
    search_fields = ['student__email', 'quiz__title']
    readonly_fields = ['started_at', 'finished_at']

@admin.register(QuestionResponse)
class QuestionResponseAdmin(admin.ModelAdmin):
    list_display = ['submission', 'question', 'marks_obtained', 'marked_at']
    readonly_fields = ['marked_at']

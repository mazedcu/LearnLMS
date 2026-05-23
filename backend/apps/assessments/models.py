import uuid
from django.db import models
from django.conf import settings

class Quiz(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE, related_name='quizzes'
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    time_limit_mins = models.PositiveIntegerField(null=True, blank=True, help_text="Time limit in minutes. Leave empty for no limit.")
    passing_score = models.PositiveIntegerField(default=70, help_text="Percentage required to pass.")
    max_attempts = models.PositiveIntegerField(default=0, help_text="0 for unlimited.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Quizzes"

    def __str__(self):
        return self.title

class Question(models.Model):
    class Type(models.TextChoices):
        MCQ = 'mcq', 'Multiple Choice'
        FILL_BLANKS = 'fill_blanks', 'Fill in the Blanks'
        KEYWORD_MATCH = 'keyword_match', 'Keyword Match'
        CALCULATED_MCQ = 'calculated_mcq', 'Calculated Multichoice'
        DRAG_DROP_WORD = 'drag_drop_word', 'Drag and Drop Word'
        DRAG_DROP_IMAGE = 'drag_drop_image', 'Drag and Drop Image'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    question_type = models.CharField(max_length=30, choices=Type.choices)
    prompt = models.TextField(help_text="The question text or instruction.")
    
    # content stores: options, correct answers, keywords, blanks config, image URLs, coordinates, etc.
    content = models.JSONField(default=dict, help_text="JSON configuration for the question type.")
    
    max_marks = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"[{self.question_type}] {self.prompt[:50]}"

class QuizSubmission(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        SUBMITTED = 'submitted', 'Submitted'
        MARKED = 'marked', 'Marked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='quiz_submissions'
    )
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='submissions')
    score = models.FloatField(default=0.0)
    total_marks = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    
    # Pre-generated per-question state (e.g. calc-MCQ variables) keyed by question UUID.
    rendered_questions = models.JSONField(
        default=dict,
        help_text="Maps question UUID -> {prompt, variables, ...}. Populated on quiz start."
    )

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    @property
    def score_percent(self):
        if self.total_marks > 0:
            return round((self.score / self.total_marks) * 100, 1)
        return 0

    def __str__(self):
        return f"{self.student.email} - {self.quiz.title} ({self.score_percent}%)"

class QuestionResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(QuizSubmission, on_delete=models.CASCADE, related_name='responses')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    
    # answer_data stores the student's response in JSON format
    answer_data = models.JSONField(default=dict)
    
    marks_obtained = models.FloatField(default=0.0)
    feedback = models.TextField(blank=True)
    is_manually_marked = models.BooleanField(default=False)
    marked_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('submission', 'question')]

    def __str__(self):
        return f"Response for {self.question.id} in Submission {self.submission.id}"

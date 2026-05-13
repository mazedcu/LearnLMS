import uuid
from django.db import models


class AIQuestion(models.Model):
    """An essay/structured question marked by DeepSeek AI."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE, related_name='ai_questions'
    )
    question_text = models.TextField()
    markscheme = models.TextField(help_text='Markscheme provided to AI for evaluation')
    max_marks = models.PositiveIntegerField(default=10)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'Q: {self.question_text[:60]}... (max {self.max_marks} marks)'


class AISubmission(models.Model):
    """Student answer to an AIQuestion, marked by DeepSeek."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='ai_submissions'
    )
    question = models.ForeignKey(AIQuestion, on_delete=models.CASCADE, related_name='submissions')
    answer_text = models.TextField()
    submitted_at = models.DateTimeField(auto_now_add=True)

    # AI evaluation
    ai_score = models.PositiveIntegerField(null=True, blank=True)
    ai_feedback = models.TextField(blank=True)
    ai_breakdown = models.JSONField(default=list, blank=True)
    ai_raw_response = models.JSONField(default=dict, blank=True)
    ai_evaluated_at = models.DateTimeField(null=True, blank=True)

    # Instructor override
    teacher_score = models.PositiveIntegerField(null=True, blank=True)
    teacher_feedback = models.TextField(blank=True)
    is_reviewed = models.BooleanField(default=False)
    reviewed_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_submissions',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('student', 'question')]
        ordering = ['-submitted_at']

    @property
    def final_score(self):
        """Returns teacher override score if reviewed, else AI score."""
        return self.teacher_score if self.is_reviewed else self.ai_score

    def __str__(self):
        return f'{self.student.email} — Q#{self.question.id} ({self.final_score}/{self.question.max_marks})'


class MoodleQuiz(models.Model):
    """Reference to a quiz hosted on Moodle."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE, related_name='moodle_quizzes'
    )
    moodle_quiz_id = models.PositiveIntegerField(help_text='Quiz ID in Moodle')
    title = models.CharField(max_length=255)
    time_limit_secs = models.PositiveIntegerField(null=True, blank=True)
    max_attempts = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.title} (Moodle ID: {self.moodle_quiz_id})'


class QuizAttempt(models.Model):
    """A student's attempt at a MoodleQuiz, proxied through Django."""

    class Status(models.TextChoices):
        IN_PROGRESS = 'in_progress', 'In Progress'
        SUBMITTED = 'submitted', 'Submitted'
        FINISHED = 'finished', 'Finished'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='quiz_attempts'
    )
    moodle_quiz = models.ForeignKey(MoodleQuiz, on_delete=models.CASCADE, related_name='attempts')
    moodle_attempt_id = models.PositiveIntegerField(null=True, blank=True)
    score = models.FloatField(null=True, blank=True)
    max_score = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_PROGRESS)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    @property
    def score_percent(self):
        if self.max_score and self.max_score > 0:
            return round((self.score / self.max_score) * 100, 1)
        return 0

    def __str__(self):
        return f'{self.student.email} — {self.moodle_quiz.title} ({self.status})'

import uuid
from django.db import models


class CriteriaType(models.TextChoices):
    TIME = 'time', 'Time After Enrollment (days)'
    COMPLETION = 'completion', 'Previous Lesson Completion'
    QUIZ_SCORE = 'quiz_score', 'Quiz Score Threshold'
    MANUAL = 'manual', 'Manual Admin Unlock'
    PURCHASE_TIER = 'purchase_tier', 'Course Tier Purchase'


class DrippingRule(models.Model):
    """Defines the unlock criteria for a single lesson."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.OneToOneField(
        'courses.Lesson', on_delete=models.CASCADE, related_name='drip_rule'
    )
    criteria_type = models.CharField(max_length=20, choices=CriteriaType.choices)

    # Time-based
    unlock_after_days = models.PositiveIntegerField(
        null=True, blank=True, help_text='Days after enrollment to unlock'
    )

    # Completion-based
    required_lesson = models.ForeignKey(
        'courses.Lesson',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='unlocks_lessons',
        help_text='Lesson that must be completed first',
    )

    # Quiz score-based
    required_score = models.PositiveIntegerField(
        null=True, blank=True, help_text='Minimum quiz score percentage (0-100) to unlock'
    )
    required_quiz = models.ForeignKey(
        'assessments.Quiz',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gates_lessons',
    )

    # Manual unlock (set per student via ContentAccess)
    is_globally_locked = models.BooleanField(default=False, help_text='Lock for all, admin unlocks individually')

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Drip rule for: {self.lesson.title} ({self.criteria_type})'


class ContentAccess(models.Model):
    """Tracks per-student, per-lesson unlock status."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(
        'courses.Enrollment', on_delete=models.CASCADE, related_name='content_access'
    )
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE, related_name='access_records'
    )
    is_unlocked = models.BooleanField(default=False)
    unlocked_at = models.DateTimeField(null=True, blank=True)
    unlock_reason = models.CharField(max_length=100, blank=True)

    class Meta:
        unique_together = [('enrollment', 'lesson')]

    def __str__(self):
        status = 'unlocked' if self.is_unlocked else 'locked'
        return f'{self.enrollment.student.email} — {self.lesson.title} ({status})'

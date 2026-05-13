import uuid
from django.db import models


class LessonProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.ForeignKey(
        'courses.Enrollment', on_delete=models.CASCADE, related_name='lesson_progress'
    )
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE, related_name='progress_records'
    )
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    time_spent_secs = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('enrollment', 'lesson')]
        ordering = ['-last_accessed']

    def __str__(self):
        status = 'done' if self.is_completed else 'in progress'
        return f'{self.enrollment.student.email} — {self.lesson.title} ({status})'


class CourseProgress(models.Model):
    """Denormalized summary updated by signals for fast dashboard queries."""
    enrollment = models.OneToOneField(
        'courses.Enrollment', on_delete=models.CASCADE, related_name='progress'
    )
    lessons_completed = models.PositiveIntegerField(default=0)
    lessons_total = models.PositiveIntegerField(default=0)
    percent_complete = models.FloatField(default=0.0)
    last_accessed = models.DateTimeField(auto_now=True)

    def recalculate(self):
        total = self.enrollment.course.modules.prefetch_related('lessons').values_list(
            'lessons', flat=True
        ).count()
        done = LessonProgress.objects.filter(
            enrollment=self.enrollment, is_completed=True
        ).count()
        self.lessons_total = total
        self.lessons_completed = done
        self.percent_complete = round((done / total * 100), 1) if total > 0 else 0.0
        self.save()

    def __str__(self):
        return f'{self.enrollment.student.email} — {self.enrollment.course.title} {self.percent_complete}%'

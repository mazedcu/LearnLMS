"""
Lesson access rules — the single place that decides who may open a lesson.

Used by the content endpoints (blocks, completion, H5P) and the assessment
endpoints (quiz list, quiz start), so a lesson locked for its content is also
locked for its quizzes.
"""
from django.utils import timezone


def is_course_staff(user, course):
    """Admins, managers, Django staff and the course's own instructor."""
    if not user.is_authenticated:
        return False
    if user.is_staff or getattr(user, 'role', '') in ('admin', 'manager'):
        return True
    return course.instructor_id == user.pk


def active_enrollment(user, course):
    """The student's active, unexpired enrollment for ``course``, or None."""
    if not user.is_authenticated:
        return None
    from apps.courses.models import Enrollment
    enrollment = Enrollment.objects.filter(student=user, course=course, is_active=True).first()
    if enrollment and enrollment.expiry_date and enrollment.expiry_date <= timezone.now():
        return None
    return enrollment


def check_lesson_access(user, lesson):
    """Return ``(enrollment, is_allowed)``.

    ``enrollment`` is only set for enrolled students; staff and preview
    visitors get ``None``.
    """
    course = lesson.module.course
    if is_course_staff(user, course):
        return None, True
    if not lesson.is_published:
        return None, False
    if lesson.is_preview:
        return active_enrollment(user, course), True
    enrollment = active_enrollment(user, course)
    if not enrollment:
        return None, False
    from apps.dripping.services import DrippingService
    return enrollment, DrippingService(enrollment).is_unlocked(lesson)

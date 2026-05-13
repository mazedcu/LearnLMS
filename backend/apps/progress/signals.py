"""
Django Signals — Progress & Dripping
-------------------------------------
Wires up:
  - LessonProgress completion → recalculate CourseProgress → trigger dripping
  - CourseProgress 100% → auto-generate Certificate
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)


@receiver(post_save, sender='progress.LessonProgress')
def on_lesson_progress_saved(sender, instance, **kwargs):
    """Recalculate course progress and trigger dripping when a lesson is completed."""
    if not instance.is_completed:
        return

    enrollment = instance.enrollment

    # 1. Update CourseProgress
    from apps.progress.models import CourseProgress
    cp, _ = CourseProgress.objects.get_or_create(enrollment=enrollment)
    cp.recalculate()

    # 2. Run dripping engine for all lessons
    from apps.dripping.services import DrippingService
    DrippingService(enrollment).unlock_all_eligible()

    # 3. If course is 100% complete, issue certificate
    if cp.percent_complete >= 100.0:
        _issue_certificate(enrollment)


def _issue_certificate(enrollment):
    from apps.certificates.models import Certificate
    from apps.certificates.generators import generate_certificate_pdf

    if Certificate.objects.filter(enrollment=enrollment).exists():
        return  # already issued

    cert = Certificate.objects.create(enrollment=enrollment)
    try:
        generate_certificate_pdf(cert)
        logger.info("Certificate issued for %s", enrollment.student.email)
    except Exception as exc:
        logger.error("Certificate PDF generation failed: %s", exc)

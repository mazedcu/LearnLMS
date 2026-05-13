"""
Content Dripping Service
-------------------------
Evaluates whether a lesson should be unlocked for a given enrollment,
based on the lesson's DrippingRule criteria.

Called by:
  - POST /api/lessons/{id}/complete/  (signals)
  - Celery beat daily task            (time-based unlock)
  - Payment verification signal       (purchase_tier unlock)
  - Admin manual unlock endpoint
"""
import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)


class DrippingService:
    def __init__(self, enrollment):
        self.enrollment = enrollment

    # ------------------------------------------------------------------ #
    # Public API                                                            #
    # ------------------------------------------------------------------ #

    def is_unlocked(self, lesson) -> bool:
        """Return True if the lesson is accessible for this enrollment."""
        # Preview lessons are always open
        if lesson.is_preview:
            return True

        # No drip rule = always unlocked for enrolled students
        if not hasattr(lesson, 'drip_rule') or lesson.drip_rule is None:
            return True

        rule = lesson.drip_rule

        evaluators = {
            'time': self._check_time,
            'completion': self._check_completion,
            'quiz_score': self._check_quiz_score,
            'manual': self._check_manual,
            'purchase_tier': self._check_purchase_tier,
        }

        evaluator = evaluators.get(rule.criteria_type)
        if not evaluator:
            return True

        return evaluator(rule)

    def evaluate_and_save(self, lesson) -> bool:
        """Check access and persist result to ContentAccess table."""
        from apps.dripping.models import ContentAccess

        unlocked = self.is_unlocked(lesson)
        access, _ = ContentAccess.objects.get_or_create(
            enrollment=self.enrollment, lesson=lesson
        )

        if unlocked and not access.is_unlocked:
            access.is_unlocked = True
            access.unlocked_at = timezone.now()
            access.unlock_reason = lesson.drip_rule.criteria_type if hasattr(lesson, 'drip_rule') and lesson.drip_rule else 'no_rule'
            access.save()
            logger.info("Unlocked lesson '%s' for %s", lesson.title, self.enrollment.student.email)

        return unlocked

    def unlock_all_eligible(self):
        """Evaluate every lesson in the course and unlock eligible ones."""
        course = self.enrollment.course
        for module in course.modules.prefetch_related('lessons__drip_rule').all():
            for lesson in module.lessons.all():
                self.evaluate_and_save(lesson)

    # ------------------------------------------------------------------ #
    # Criteria evaluators                                                   #
    # ------------------------------------------------------------------ #

    def _check_time(self, rule) -> bool:
        if rule.unlock_after_days is None:
            return False
        unlock_date = self.enrollment.enrolled_at + timedelta(days=rule.unlock_after_days)
        return timezone.now() >= unlock_date

    def _check_completion(self, rule) -> bool:
        if not rule.required_lesson:
            return False
        from apps.progress.models import LessonProgress
        return LessonProgress.objects.filter(
            enrollment=self.enrollment,
            lesson=rule.required_lesson,
            is_completed=True,
        ).exists()

    def _check_quiz_score(self, rule) -> bool:
        if not rule.required_quiz or rule.required_score is None:
            return False
        from apps.assessments.models import QuizAttempt
        best = (
            QuizAttempt.objects.filter(
                student=self.enrollment.student,
                moodle_quiz=rule.required_quiz,
                status=QuizAttempt.Status.FINISHED,
            )
            .order_by('-score')
            .first()
        )
        if not best:
            return False
        return best.score_percent >= rule.required_score

    def _check_manual(self, rule) -> bool:
        from apps.dripping.models import ContentAccess
        access = ContentAccess.objects.filter(
            enrollment=self.enrollment,
            lesson=rule.lesson,
        ).first()
        return access.is_unlocked if access else False

    def _check_purchase_tier(self, rule) -> bool:
        # All verified orders grant access — tier differentiation can be added later
        from apps.payments.models import Order, OrderStatus
        return Order.objects.filter(
            student=self.enrollment.student,
            course=self.enrollment.course,
            status=OrderStatus.VERIFIED,
        ).exists()

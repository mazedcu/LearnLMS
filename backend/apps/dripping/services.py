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

    def lock_info(self, lesson) -> dict:
        """Explain why a lesson is locked, for display to the student.

        Returns ``{'reason': <criteria_type>, 'message': str, 'unlock_at': iso|None}``.
        Only meaningful when ``is_unlocked(lesson)`` is False.
        """
        rule = getattr(lesson, 'drip_rule', None)
        if rule is None:
            return {'reason': 'locked', 'message': 'This lesson is locked.', 'unlock_at': None}

        info = {'reason': rule.criteria_type, 'message': 'This lesson is locked.', 'unlock_at': None}
        if rule.criteria_type == 'time' and rule.unlock_after_days is not None:
            unlock_at = self.enrollment.enrolled_at + timedelta(days=rule.unlock_after_days)
            info['unlock_at'] = unlock_at.isoformat()
            info['message'] = f'Unlocks on {timezone.localtime(unlock_at):%d %b %Y}.'
        elif rule.criteria_type == 'completion' and rule.required_lesson:
            info['message'] = f'Complete "{rule.required_lesson.title}" to unlock this lesson.'
            info['required_lesson'] = str(rule.required_lesson_id)
        elif rule.criteria_type == 'quiz_score' and rule.required_quiz:
            info['message'] = (
                f'Score at least {rule.required_score}% in "{rule.required_quiz.title}" to unlock.'
            )
            info['required_lesson'] = str(rule.required_quiz.lesson_id)
        elif rule.criteria_type == 'manual':
            info['message'] = 'Your teacher will unlock this lesson.'
        elif rule.criteria_type == 'purchase_tier':
            info['message'] = 'Unlocks once your payment is verified.'
        return info

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
        from apps.assessments.models import QuizSubmission
        best = (
            QuizSubmission.objects.filter(
                student=self.enrollment.student,
                quiz=rule.required_quiz,
                status__in=[QuizSubmission.Status.SUBMITTED, QuizSubmission.Status.MARKED],
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

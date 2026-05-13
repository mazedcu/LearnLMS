"""
Django Signals — Payments
--------------------------
When an Order is verified, create Enrollment and send confirmation email.
"""
import logging

from django.core.mail import send_mail
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.conf import settings

logger = logging.getLogger(__name__)


@receiver(pre_save, sender='payments.Order')
def on_order_verified(sender, instance, **kwargs):
    """Create enrollment and send email when admin verifies an order."""
    if not instance.pk:
        return  # new object, not an update

    from apps.payments.models import Order
    try:
        previous = Order.objects.get(pk=instance.pk)
    except Order.DoesNotExist:
        return

    # Trigger only on status change TO 'verified'
    if previous.status != 'verified' and instance.status == 'verified':
        _create_enrollment(instance)
        _send_enrollment_email(instance)


def _create_enrollment(order):
    from apps.courses.models import Enrollment
    enrollment, created = Enrollment.objects.get_or_create(
        student=order.student,
        course=order.course,
        defaults={'is_active': True},
    )
    if not created and not enrollment.is_active:
        enrollment.is_active = True
        enrollment.save()
    logger.info(
        "Enrollment %s for %s in '%s'",
        'created' if created else 'reactivated',
        order.student.email,
        order.course.title,
    )
    return enrollment


def _send_enrollment_email(order):
    subject = f"Enrollment Confirmed — {order.course.title}"
    message = (
        f"Dear {order.student.full_name},\n\n"
        f"Your payment has been verified and you are now enrolled in:\n"
        f"  {order.course.title}\n\n"
        f"Start learning: {settings.FRONTEND_URL}/learn/{order.course.slug}\n\n"
        f"Payment Reference: {order.payment_reference}\n"
        f"Amount Paid: BDT {order.amount}\n\n"
        f"Thank you!\nThe LMS Team"
    )
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[order.student.email],
            fail_silently=False,
        )
        logger.info("Enrollment email sent to %s", order.student.email)
    except Exception as exc:
        logger.error("Failed to send enrollment email: %s", exc)

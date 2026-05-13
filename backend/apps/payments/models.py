import uuid
from django.db import models


class PaymentMethod(models.TextChoices):
    BKASH = 'bkash', 'bKash'
    NAGAD = 'nagad', 'Nagad'


class OrderStatus(models.TextChoices):
    PENDING = 'pending', 'Pending Reference'
    SUBMITTED = 'submitted', 'Reference Submitted'
    VERIFIED = 'verified', 'Verified & Active'
    REJECTED = 'rejected', 'Rejected'


class Order(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(
        'accounts.CustomUser', on_delete=models.CASCADE, related_name='orders'
    )
    course = models.ForeignKey(
        'courses.Course', on_delete=models.CASCADE, related_name='orders'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text='Amount in BDT')
    payment_method = models.CharField(
        max_length=10, choices=PaymentMethod.choices, blank=True
    )
    payment_reference = models.CharField(
        max_length=100, blank=True, help_text='Transaction ID / reference from bKash or Nagad'
    )
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)

    # Admin verification
    admin_note = models.TextField(blank=True)
    verified_by = models.ForeignKey(
        'accounts.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_orders',
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Order {self.id} — {self.student.email} → {self.course.title} ({self.status})'

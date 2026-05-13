import uuid
from django.db import models


class Certificate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment = models.OneToOneField(
        'courses.Enrollment', on_delete=models.CASCADE, related_name='certificate'
    )
    certificate_number = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    issued_at = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to='certificates/', blank=True, null=True)

    class Meta:
        ordering = ['-issued_at']

    def __str__(self):
        return f'Certificate {self.certificate_number} — {self.enrollment.student.email}'

    @property
    def verification_url(self):
        from django.conf import settings
        return f'{settings.FRONTEND_URL}/certificates/{self.certificate_number}'

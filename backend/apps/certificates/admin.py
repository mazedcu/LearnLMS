from django.contrib import admin
from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display  = ['certificate_number', 'enrollment', 'issued_at']
    search_fields = ['enrollment__student__email', 'enrollment__course__title']
    readonly_fields = ['id', 'certificate_number', 'issued_at', 'verification_url']

    def verification_url(self, obj):
        return obj.verification_url

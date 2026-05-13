from rest_framework import serializers
from .models import Certificate


class CertificateSerializer(serializers.ModelSerializer):
    student_name  = serializers.CharField(source='enrollment.student.full_name', read_only=True)
    course_title  = serializers.CharField(source='enrollment.course.title', read_only=True)
    verification_url = serializers.CharField(read_only=True)

    class Meta:
        model = Certificate
        fields = [
            'id', 'certificate_number', 'student_name', 'course_title',
            'issued_at', 'pdf_file', 'verification_url',
        ]

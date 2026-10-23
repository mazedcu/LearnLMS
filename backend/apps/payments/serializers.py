from rest_framework import serializers
import re

from .models import Order, PaymentSettings


class OrderSerializer(serializers.ModelSerializer):
    course_title  = serializers.CharField(source='course.title', read_only=True)
    course_slug   = serializers.CharField(source='course.slug', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    course_thumbnail = serializers.ImageField(source='course.thumbnail', read_only=True)
    reference_used_on = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'course', 'course_title', 'course_slug', 'course_thumbnail',
            'student_email', 'amount', 'payment_method', 'payment_reference',
            'status', 'admin_note', 'created_at', 'verified_at', 'reference_used_on',
        ]
        read_only_fields = ['id', 'student_email', 'status', 'admin_note', 'created_at', 'verified_at']

    def get_reference_used_on(self, obj):
        """Other non-rejected orders with the same transaction ID — a sign the
        reference was copied. Only shown to admins/managers."""
        request = self.context.get('request')
        if not obj.payment_reference or not request or getattr(request.user, 'role', '') not in ('admin', 'manager'):
            return []
        others = (
            Order.objects.filter(payment_reference__iexact=obj.payment_reference.strip())
            .exclude(pk=obj.pk).exclude(status='rejected')
            .select_related('student')
        )
        return [{'student_email': o.student.email, 'status': o.status} for o in others[:5]]


class CreateOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['course', 'payment_method']

    def validate_course(self, course):
        if course.is_free:
            raise serializers.ValidationError('This course is free. Use the enroll endpoint instead.')
        return course

    def create(self, validated_data):
        course = validated_data['course']
        request = self.context['request']

        # Check for duplicate pending order
        existing = Order.objects.filter(
            student=request.user, course=course, status__in=['pending', 'submitted']
        ).first()
        if existing:
            return existing  # return existing order

        return Order.objects.create(
            student=request.user,
            amount=course.price,
            **validated_data,
        )


class SubmitReferenceSerializer(serializers.Serializer):
    payment_reference = serializers.CharField(min_length=4, max_length=100)
    payment_method    = serializers.ChoiceField(choices=['bkash', 'nagad'])

    def validate_payment_reference(self, value):
        return value.strip().upper()


PHONE_RE = re.compile(r'^\+?[0-9][0-9 -]{6,18}[0-9]$')


class PaymentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSettings
        fields = ['bkash_number', 'nagad_number', 'instructions', 'updated_at']
        read_only_fields = ['updated_at']

    def _check(self, value):
        value = (value or '').strip()
        if value and not PHONE_RE.match(value):
            raise serializers.ValidationError('Enter a phone number, e.g. 01676885195.')
        return value

    def validate_bkash_number(self, value):
        return self._check(value)

    def validate_nagad_number(self, value):
        return self._check(value)


class VerifyOrderSerializer(serializers.Serializer):
    action     = serializers.ChoiceField(choices=['verified', 'rejected'])
    admin_note = serializers.CharField(allow_blank=True, default='')

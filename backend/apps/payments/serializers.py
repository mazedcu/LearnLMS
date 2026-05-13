from rest_framework import serializers
from .models import Order


class OrderSerializer(serializers.ModelSerializer):
    course_title  = serializers.CharField(source='course.title', read_only=True)
    course_slug   = serializers.CharField(source='course.slug', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    course_thumbnail = serializers.ImageField(source='course.thumbnail', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'course', 'course_title', 'course_slug', 'course_thumbnail',
            'student_email', 'amount', 'payment_method', 'payment_reference',
            'status', 'admin_note', 'created_at', 'verified_at',
        ]
        read_only_fields = ['id', 'student_email', 'status', 'admin_note', 'created_at', 'verified_at']


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


class VerifyOrderSerializer(serializers.Serializer):
    action     = serializers.ChoiceField(choices=['verified', 'rejected'])
    admin_note = serializers.CharField(allow_blank=True, default='')

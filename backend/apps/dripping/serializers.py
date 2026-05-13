from rest_framework import serializers
from .models import DrippingRule, ContentAccess


class DrippingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrippingRule
        fields = [
            'id', 'lesson', 'criteria_type',
            'unlock_after_days', 'required_lesson', 'required_score', 'required_quiz',
            'is_globally_locked',
        ]


class ContentAccessSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)

    class Meta:
        model = ContentAccess
        fields = ['id', 'enrollment', 'lesson', 'lesson_title', 'is_unlocked', 'unlocked_at', 'unlock_reason']
        read_only_fields = ['id', 'unlocked_at', 'unlock_reason']

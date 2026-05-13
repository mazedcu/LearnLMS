from rest_framework import serializers
from .models import LessonProgress, CourseProgress


class LessonProgressSerializer(serializers.ModelSerializer):
    lesson_title = serializers.CharField(source='lesson.title', read_only=True)
    lesson_order = serializers.IntegerField(source='lesson.order', read_only=True)

    class Meta:
        model = LessonProgress
        fields = [
            'id', 'lesson', 'lesson_title', 'lesson_order',
            'is_completed', 'completed_at', 'time_spent_secs', 'last_accessed',
        ]


class CourseProgressSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='enrollment.course.title', read_only=True)
    course_slug  = serializers.CharField(source='enrollment.course.slug', read_only=True)
    lesson_progress = LessonProgressSerializer(
        source='enrollment.lesson_progress', many=True, read_only=True
    )

    class Meta:
        model = CourseProgress
        fields = [
            'course_title', 'course_slug',
            'lessons_completed', 'lessons_total', 'percent_complete',
            'last_accessed', 'lesson_progress',
        ]

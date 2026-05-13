from rest_framework import serializers
from .models import Course, Module, Lesson, Enrollment


class LessonSerializer(serializers.ModelSerializer):
    drip_criteria = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'title', 'order', 'is_published', 'is_preview',
            'estimated_duration_mins', 'drip_criteria',
        ]

    def get_drip_criteria(self, obj):
        if hasattr(obj, 'drip_rule') and obj.drip_rule:
            return {
                'type': obj.drip_rule.criteria_type,
                'unlock_after_days': obj.drip_rule.unlock_after_days,
            }
        return None


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)

    class Meta:
        model = Module
        fields = ['id', 'title', 'description', 'order', 'lessons']


class CourseListSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(source='instructor.full_name', read_only=True)
    lesson_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'short_description', 'thumbnail',
            'price', 'is_free', 'status', 'instructor_name',
            'lesson_count', 'language', 'created_at',
        ]

    def get_lesson_count(self, obj):
        return Lesson.objects.filter(module__course=obj, is_published=True).count()


class CourseDetailSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(source='instructor.full_name', read_only=True)
    instructor_id   = serializers.CharField(source='instructor.id', read_only=True)
    modules = ModuleSerializer(many=True, read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    lesson_count = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'description', 'short_description',
            'thumbnail', 'price', 'is_free', 'status', 'requirements',
            'outcomes', 'language', 'instructor_name', 'instructor_id',
            'modules', 'is_enrolled', 'lesson_count', 'created_at',
        ]

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return Enrollment.objects.filter(
            student=request.user, course=obj, is_active=True
        ).exists()

    def get_lesson_count(self, obj):
        return Lesson.objects.filter(module__course=obj, is_published=True).count()


class CourseWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            'title', 'short_description', 'description', 'thumbnail',
            'price', 'is_free', 'status', 'requirements', 'outcomes', 'language',
        ]

    def create(self, validated_data):
        request = self.context['request']
        validated_data['instructor'] = request.user
        return super().create(validated_data)


class ModuleWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['title', 'description', 'order']


class LessonWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['title', 'order', 'is_published', 'is_preview', 'estimated_duration_mins']


class EnrollmentSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    course_slug  = serializers.CharField(source='course.slug', read_only=True)
    student_email = serializers.CharField(source='student.email', read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            'id', 'course_title', 'course_slug', 'student_email',
            'enrolled_at', 'is_active', 'progress',
        ]

    def get_progress(self, obj):
        if hasattr(obj, 'progress'):
            return {
                'percent': obj.progress.percent_complete,
                'completed': obj.progress.lessons_completed,
                'total': obj.progress.lessons_total,
            }
        return {'percent': 0, 'completed': 0, 'total': 0}

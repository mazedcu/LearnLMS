from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count, Avg

from apps.courses.models import Enrollment, Lesson
from apps.common.permissions import IsAdminOrManager, IsInstructorOrAdmin
from apps.accounts.models import CustomUser
from .models import LessonProgress, CourseProgress
from .serializers import CourseProgressSerializer


class CourseProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, enrollment_pk):
        enrollment = get_object_or_404(Enrollment, pk=enrollment_pk)
        user = request.user
        if user.role not in ('admin', 'manager') and enrollment.student != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied

        cp, _ = CourseProgress.objects.get_or_create(enrollment=enrollment)
        cp.recalculate()
        return Response(CourseProgressSerializer(cp).data)


class StudentAnalyticsView(APIView):
    """Detailed analytics for a student — admin/manager or self."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_pk):
        target = get_object_or_404(CustomUser, pk=user_pk)
        user   = request.user
        if user.role not in ('admin', 'manager') and user != target:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied

        enrollments = (
            Enrollment.objects
            .filter(student=target, is_active=True)
            .select_related('course', 'progress')
        )
        data = []
        for enr in enrollments:
            cp = getattr(enr, 'progress', None)
            data.append({
                'course_title':       enr.course.title,
                'course_slug':        enr.course.slug,
                'enrolled_at':        enr.enrolled_at,
                'percent_complete':   cp.percent_complete if cp else 0,
                'lessons_completed':  cp.lessons_completed if cp else 0,
                'lessons_total':      cp.lessons_total if cp else 0,
            })

        return Response({'student': target.email, 'enrollments': data})


class CourseAnalyticsView(APIView):
    """Aggregate analytics for a course — instructor or admin."""
    permission_classes = [IsInstructorOrAdmin]

    def get(self, request, slug):
        from apps.courses.models import Course
        course = get_object_or_404(Course, slug=slug)
        user   = request.user
        if user.role not in ('admin', 'manager') and course.instructor != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied

        total_enrolled = Enrollment.objects.filter(course=course, is_active=True).count()
        avg_progress   = (
            CourseProgress.objects
            .filter(enrollment__course=course)
            .aggregate(avg=Avg('percent_complete'))['avg'] or 0
        )
        completions = CourseProgress.objects.filter(
            enrollment__course=course, percent_complete=100
        ).count()

        lesson_stats = (
            LessonProgress.objects
            .filter(lesson__module__course=course, is_completed=True)
            .values('lesson__title', 'lesson__order')
            .annotate(completions=Count('id'))
            .order_by('lesson__order')
        )

        return Response({
            'course': course.title,
            'total_enrolled': total_enrolled,
            'avg_progress_percent': round(avg_progress, 1),
            'total_completions': completions,
            'lesson_completion_stats': list(lesson_stats),
        })

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db.models import Count, Avg, Q

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


class AdminUserActivityReportView(APIView):
    """Admin-only: overview of all user activity (enrollments, progress, quiz results)."""
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        users = CustomUser.objects.all().order_by('-date_joined')
        report = []
        for user in users:
            enrollments = Enrollment.objects.filter(student=user, is_active=True)
            enrollment_data = []
            for enr in enrollments.select_related('course', 'progress'):
                cp = getattr(enr, 'progress', None)
                enrollment_data.append({
                    'course_title': enr.course.title,
                    'course_slug': enr.course.slug,
                    'enrolled_at': enr.enrolled_at,
                    'percent_complete': cp.percent_complete if cp else 0,
                    'lessons_completed': cp.lessons_completed if cp else 0,
                    'lessons_total': cp.lessons_total if cp else 0,
                })

            # Quiz results
            from apps.assessments.models import QuizSubmission
            submissions = (
                QuizSubmission.objects
                .filter(student=user)
                .select_related('quiz')
                .order_by('-finished_at')
            )
            quiz_results = []
            for sub in submissions:
                quiz_results.append({
                    'quiz_title': sub.quiz.title,
                    'score': sub.score,
                    'total_marks': sub.total_marks,
                    'score_percent': sub.score_percent,
                    'status': sub.status,
                    'started_at': sub.started_at,
                    'finished_at': sub.finished_at,
                })

            report.append({
                'user_id': str(user.id),
                'email': user.email,
                'full_name': user.get_full_name(),
                'role': user.role,
                'date_joined': user.date_joined,
                'is_active': user.is_active,
                'enrollments': enrollment_data,
                'total_enrollments': len(enrollment_data),
                'quiz_results': quiz_results,
                'total_quizzes_taken': len(quiz_results),
            })

        return Response(report)


class AdminQuizResultsReportView(APIView):
    """Admin-only: all quiz submissions across platform."""
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        from apps.assessments.models import QuizSubmission
        submissions = (
            QuizSubmission.objects
            .select_related('student', 'quiz', 'quiz__lesson')
            .order_by('-finished_at')
        )
        report = []
        for sub in submissions:
            report.append({
                'submission_id': str(sub.id),
                'student_email': sub.student.email,
                'student_name': sub.student.get_full_name(),
                'quiz_title': sub.quiz.title,
                'lesson_title': sub.quiz.lesson.title if sub.quiz.lesson else None,
                'score': sub.score,
                'total_marks': sub.total_marks,
                'score_percent': sub.score_percent,
                'status': sub.status,
                'started_at': sub.started_at,
                'finished_at': sub.finished_at,
            })
        return Response(report)


class AdminRecentActivityView(APIView):
    """Admin-only: recent enrollments, completions, and quiz submissions."""
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        # Recent enrollments (last 7 days)
        from django.utils import timezone
        from datetime import timedelta
        since = timezone.now() - timedelta(days=7)

        recent_enrollments = (
            Enrollment.objects
            .filter(enrolled_at__gte=since, is_active=True)
            .select_related('student', 'course')
            .order_by('-enrolled_at')[:20]
        )
        enroll_data = []
        for e in recent_enrollments:
            enroll_data.append({
                'type': 'enrollment',
                'timestamp': e.enrolled_at,
                'user_email': e.student.email,
                'user_name': e.student.get_full_name(),
                'detail': f"Enrolled in {e.course.title}",
            })

        # Recent lesson completions
        recent_completions = (
            LessonProgress.objects
            .filter(is_completed=True, completed_at__gte=since)
            .select_related('enrollment__student', 'lesson')
            .order_by('-completed_at')[:20]
        )
        complete_data = []
        for c in recent_completions:
            complete_data.append({
                'type': 'completion',
                'timestamp': c.completed_at,
                'user_email': c.enrollment.student.email,
                'user_name': c.enrollment.student.get_full_name(),
                'detail': f"Completed lesson: {c.lesson.title}",
            })

        # Recent quiz submissions
        from apps.assessments.models import QuizSubmission
        recent_quizzes = (
            QuizSubmission.objects
            .filter(finished_at__gte=since)
            .select_related('student', 'quiz')
            .order_by('-finished_at')[:20]
        )
        quiz_data = []
        for q in recent_quizzes:
            quiz_data.append({
                'type': 'quiz',
                'timestamp': q.finished_at,
                'user_email': q.student.email,
                'user_name': q.student.get_full_name(),
                'detail': f"Quiz: {q.quiz.title} — {q.score_percent}%",
            })

        # Merge and sort by timestamp
        all_activity = enroll_data + complete_data + quiz_data
        all_activity.sort(key=lambda x: x['timestamp'] or timezone.min, reverse=True)

        return Response(all_activity[:30])

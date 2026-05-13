from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.courses.models import Lesson, Enrollment
from apps.progress.models import LessonProgress, CourseProgress
from apps.dripping.services import DrippingService
from .models import ContentBlock
from .serializers import ContentBlockSerializer, ContentBlockWriteSerializer
from apps.common.permissions import IsInstructorOrAdmin


def _check_lesson_access(user, lesson):
    """Return (enrollment, is_allowed)."""
    if lesson.is_preview:
        return None, True
    if not user.is_authenticated:
        return None, False
    if user.role in ('admin', 'manager'):
        return None, True
    course = lesson.module.course
    if course.instructor == user:
        return None, True
    enrollment = Enrollment.objects.filter(student=user, course=course, is_active=True).first()
    if not enrollment:
        return None, False
    allowed = DrippingService(enrollment).is_unlocked(lesson)
    return enrollment, allowed


class ContentBlockListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsInstructorOrAdmin()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        return ContentBlockWriteSerializer if self.request.method == 'POST' else ContentBlockSerializer

    def get_queryset(self):
        lesson = get_object_or_404(Lesson, pk=self.kwargs['lesson_pk'])
        user = self.request.user
        _, allowed = _check_lesson_access(user, lesson)
        if not allowed:
            return ContentBlock.objects.none()
        return ContentBlock.objects.filter(lesson=lesson).order_by('order')

    def perform_create(self, serializer):
        lesson = get_object_or_404(Lesson, pk=self.kwargs['lesson_pk'])
        serializer.save(lesson=lesson)


class ContentBlockDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ContentBlock.objects.all()

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsInstructorOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ContentBlockWriteSerializer
        return ContentBlockSerializer


class LessonDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, lesson_pk):
        lesson = get_object_or_404(
            Lesson.objects.select_related('module__course').prefetch_related('drip_rule'),
            pk=lesson_pk,
        )
        _, allowed = _check_lesson_access(request.user, lesson)
        from apps.courses.serializers import LessonSerializer
        data = LessonSerializer(lesson).data
        data['is_accessible'] = allowed
        data['course_slug'] = lesson.module.course.slug
        return Response(data)


class LessonCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk)
        enrollment, allowed = _check_lesson_access(request.user, lesson)
        if not allowed:
            return Response({'detail': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        if not enrollment:
            return Response({'detail': 'Not enrolled.'}, status=status.HTTP_400_BAD_REQUEST)

        progress, created = LessonProgress.objects.get_or_create(
            enrollment=enrollment, lesson=lesson
        )
        if not progress.is_completed:
            progress.is_completed = True
            progress.completed_at = timezone.now()
            progress.save()

        cp, _ = CourseProgress.objects.get_or_create(enrollment=enrollment)
        cp.recalculate()

        return Response({'completed': True, 'course_progress': cp.percent_complete})


class LessonDripStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lesson_pk):
        lesson = get_object_or_404(Lesson.objects.prefetch_related('drip_rule'), pk=lesson_pk)
        enrollment, allowed = _check_lesson_access(request.user, lesson)
        rule = getattr(lesson, 'drip_rule', None)
        return Response({
            'lesson_id': str(lesson.id),
            'is_accessible': allowed,
            'criteria_type': rule.criteria_type if rule else None,
            'is_preview': lesson.is_preview,
        })

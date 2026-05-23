from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Course, Module, Lesson, Enrollment
from .serializers import (
    CourseListSerializer, CourseDetailSerializer, CourseWriteSerializer,
    ModuleSerializer, ModuleWriteSerializer,
    LessonSerializer, LessonWriteSerializer,
    EnrollmentSerializer,
)
from apps.common.permissions import IsInstructorOrAdmin, ReadOnlyOrInstructorOwner


# ─── Courses ──────────────────────────────────────────────────────────────────

class CourseListCreateView(generics.ListCreateAPIView):
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    search_fields   = ['title', 'description', 'instructor__first_name']
    ordering_fields = ['created_at', 'price', 'title']
    ordering        = ['-created_at']

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsInstructorOrAdmin()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        return CourseWriteSerializer if self.request.method == 'POST' else CourseListSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated and user.role in ('admin', 'manager'):
            return Course.objects.select_related('instructor').all()
        if user.is_authenticated and user.role == 'instructor':
            from django.db.models import Q
            return Course.objects.filter(Q(status='published') | Q(instructor=user))
        return Course.objects.filter(status='published').select_related('instructor')

    def create(self, request, *args, **kwargs):
        serializer = CourseWriteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        course = serializer.save()
        return Response(CourseDetailSerializer(course, context={'request': request}).data,
                        status=status.HTTP_201_CREATED)


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.prefetch_related('modules__lessons__drip_rule').select_related('instructor')
    lookup_field = 'slug'

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsInstructorOrAdmin()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return CourseWriteSerializer
        return CourseDetailSerializer

    def get_object(self):
        course = super().get_object()
        user = self.request.user
        if course.status != 'published':
            if not user.is_authenticated:
                from rest_framework.exceptions import NotFound
                raise NotFound
            if user.role not in ('admin', 'manager') and course.instructor != user:
                from rest_framework.exceptions import NotFound
                raise NotFound
        return course


# ─── Modules ──────────────────────────────────────────────────────────────────

class ModuleListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsInstructorOrAdmin()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        return ModuleWriteSerializer if self.request.method == 'POST' else ModuleSerializer

    def get_queryset(self):
        course = get_object_or_404(Course, slug=self.kwargs['slug'])
        return Module.objects.filter(course=course).prefetch_related('lessons')

    def perform_create(self, serializer):
        course = get_object_or_404(Course, slug=self.kwargs['slug'])
        serializer.save(course=course)


class ModuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Module.objects.all()

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsInstructorOrAdmin()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ModuleWriteSerializer
        return ModuleSerializer


# ─── Lessons ──────────────────────────────────────────────────────────────────

class LessonListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsInstructorOrAdmin()]
        return [permissions.IsAuthenticatedOrReadOnly()]

    def get_serializer_class(self):
        return LessonWriteSerializer if self.request.method == 'POST' else LessonSerializer

    def get_queryset(self):
        module = get_object_or_404(Module, pk=self.kwargs['module_pk'])
        return Lesson.objects.filter(module=module, is_published=True)

    def perform_create(self, serializer):
        module = get_object_or_404(Module, pk=self.kwargs['module_pk'])
        serializer.save(module=module)


class LessonDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Lesson.objects.select_related('module__course').prefetch_related('drip_rule')

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [IsInstructorOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return LessonWriteSerializer
        return LessonSerializer


# ─── Enrollment ───────────────────────────────────────────────────────────────

class EnrollView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        course = get_object_or_404(Course, slug=slug, status='published')
        if not course.is_free:
            return Response(
                {'detail': 'This course requires payment. Please purchase first.'},
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )
        enrollment, created = Enrollment.objects.get_or_create(
            student=request.user, course=course, defaults={'is_active': True}
        )
        if not created and not enrollment.is_active:
            enrollment.is_active = True
            enrollment.save()
        # Trigger dripping evaluation on enrollment
        from apps.dripping.services import DrippingService
        DrippingService(enrollment).unlock_all_eligible()
        return Response(EnrollmentSerializer(enrollment).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class MyEnrollmentsView(generics.ListAPIView):
    serializer_class = EnrollmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Enrollment.objects
            .filter(student=self.request.user, is_active=True)
            .select_related('course', 'course__instructor')
            .prefetch_related('progress')
        )

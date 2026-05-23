from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.http import HttpResponse, FileResponse
from django.conf import settings
import os

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


class H5PServeView(APIView):
    """Serve extracted H5P content with h5p-standalone player."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, block_id):
        import zipfile
        import json as _json
        block = get_object_or_404(ContentBlock, pk=block_id)

        if block.block_type != 'h5p':
            return HttpResponse('Not an H5P block', status=404)

        # Extract on-the-fly if needed
        extract_dir = os.path.join(settings.MEDIA_ROOT, 'h5p_extracted', str(block.id))
        if block.file and not block.h5p_extracted_path:
            try:
                os.makedirs(extract_dir, exist_ok=True)
                with zipfile.ZipFile(block.file.path, 'r') as zf:
                    zf.extractall(extract_dir)
                block.h5p_extracted_path = f'h5p_extracted/{block.id}'
                block.save(update_fields=['h5p_extracted_path'])
            except Exception:
                pass

        h5p_path = block.h5p_extracted_path
        if not h5p_path and block.file:
            h5p_path = f'h5p_extracted/{block.id}'

        if not h5p_path or not os.path.exists(extract_dir):
            return HttpResponse('H5P content not available', status=404)

        # Use relative URL so requests go through the frontend proxy (avoids CORS issues)
        h5p_base_url = f'/media/{h5p_path}'

        # Serve an HTML page with h5p-standalone player
        title = block.title or 'H5P Content'
        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/h5p-standalone@3.8.0/dist/styles/h5p.css">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ background: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
        #h5p-container {{ width: 100%; min-height: 100vh; }}
        .h5p-loading {{
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; color: #555; font-size: 1.1rem;
        }}
        .h5p-error {{
            display: flex; align-items: center; justify-content: center;
            min-height: 200px; color: #c0392b; font-size: 1rem;
            padding: 2rem; text-align: center;
        }}
    </style>
</head>
<body>
    <div id="h5p-container">
        <div class="h5p-loading">Loading H5P content&hellip;</div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/h5p-standalone@3.8.0/dist/main.bundle.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {{
            var el = document.getElementById('h5p-container');
            var options = {{
                h5pJsonPath: '{h5p_base_url}',
                frameJs: 'https://cdn.jsdelivr.net/npm/h5p-standalone@3.8.0/dist/frame.bundle.js',
                frameCss: 'https://cdn.jsdelivr.net/npm/h5p-standalone@3.8.0/dist/styles/h5p.css',
            }};

            try {{
                new H5PStandalone.H5P(el, options)
                    .then(function() {{
                        console.log('H5P content rendered successfully');
                    }})
                    .catch(function(err) {{
                        console.error('H5P render promise error:', err);
                        el.innerHTML = '<div class="h5p-error">Failed to load H5P content: ' + err.message + '</div>';
                    }});
            }} catch (err) {{
                console.error('H5P init error:', err);
                el.innerHTML = '<div class="h5p-error">Failed to initialize H5P player: ' + err.message + '</div>';
            }}
        }});
    </script>
</body>
</html>'''

        return HttpResponse(html, content_type='text/html')

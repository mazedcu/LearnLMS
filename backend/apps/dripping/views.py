from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.courses.models import Lesson, Enrollment
from apps.common.permissions import IsAdmin
from .models import DrippingRule, ContentAccess
from .serializers import DrippingRuleSerializer, ContentAccessSerializer
from .services import DrippingService


class DrippingRuleView(generics.RetrieveUpdateAPIView):
    """GET/PATCH the dripping rule for a specific lesson."""
    queryset = DrippingRule.objects.all()
    serializer_class = DrippingRuleSerializer
    lookup_field = 'lesson__id'
    lookup_url_kwarg = 'lesson_pk'

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]


class DrippingRuleCreateView(generics.CreateAPIView):
    serializer_class = DrippingRuleSerializer
    permission_classes = [IsAdmin]


class ManualUnlockView(APIView):
    """Admin unlocks a lesson for a specific student enrollment."""
    permission_classes = [IsAdmin]

    def post(self, request, lesson_pk):
        lesson = get_object_or_404(Lesson, pk=lesson_pk)
        enrollment_id = request.data.get('enrollment_id')
        if not enrollment_id:
            return Response({'detail': 'enrollment_id required.'}, status=status.HTTP_400_BAD_REQUEST)

        enrollment = get_object_or_404(Enrollment, pk=enrollment_id)
        access, _ = ContentAccess.objects.get_or_create(enrollment=enrollment, lesson=lesson)
        access.is_unlocked = True
        access.unlocked_at = timezone.now()
        access.unlock_reason = 'manual'
        access.save()

        return Response({'detail': f'Lesson unlocked for {enrollment.student.email}.'})


class EvaluateDripView(APIView):
    """Re-evaluate drip rules for an enrollment (admin/system use)."""
    permission_classes = [IsAdmin]

    def post(self, request, enrollment_pk):
        enrollment = get_object_or_404(Enrollment, pk=enrollment_pk)
        DrippingService(enrollment).unlock_all_eligible()
        return Response({'detail': 'Drip evaluation complete.'})

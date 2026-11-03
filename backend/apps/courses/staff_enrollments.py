"""
Manual enrollment by admins and managers
----------------------------------------
  GET   /api/courses/enrollments/manage/?student=<id>   the student, their
        enrollments (active or not) and every course they could be admitted to
  POST  /api/courses/enrollments/manage/                 admit one student to
        several courses: {"student": id, "courses": [id, ...], "expiry_date": iso|null}
  PATCH /api/courses/enrollments/manage/<id>/            {"is_active": bool, "expiry_date": iso|null}
"""
from datetime import datetime

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date, parse_datetime
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import CustomUser
from apps.common.permissions import IsAdminOrManager
from .models import Course, Enrollment


def _expiry(value):
    """'' / None → no end date; 'YYYY-MM-DD' → end of that day; full ISO time as given."""
    if value in (None, ''):
        return None
    text = str(value).strip()
    try:
        d = parse_date(text) if len(text) == 10 else None
        dt = datetime(d.year, d.month, d.day, 23, 59, 59) if d else parse_datetime(text)
    except ValueError:
        dt = None
    if dt is None:
        raise ValidationError({'expiry_date': 'Use a date like 2027-06-30.'})
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt)
    return dt


def _row(e):
    now = timezone.now()
    return {
        'id': str(e.id),
        'course': str(e.course_id),
        'course_title': e.course.title,
        'course_slug': e.course.slug,
        'is_active': e.is_active,
        'expired': bool(e.expiry_date and e.expiry_date <= now),
        'enrolled_at': e.enrolled_at,
        'expiry_date': e.expiry_date,
    }


def _student_state(student):
    enrollments = Enrollment.objects.filter(student=student).select_related('course').order_by('course__title')
    courses = Course.objects.order_by('title').values('id', 'title', 'slug', 'status', 'price', 'is_free')
    return {
        'student': {
            'id': str(student.id), 'email': student.email,
            'name': f'{student.first_name} {student.last_name}'.strip() or student.username,
        },
        'enrollments': [_row(e) for e in enrollments],
        'courses': [{**c, 'id': str(c['id']), 'price': str(c['price'])} for c in courses],
    }


class StaffEnrollmentView(APIView):
    permission_classes = [IsAdminOrManager]

    def get(self, request):
        student = get_object_or_404(CustomUser, pk=request.query_params.get('student'))
        return Response(_student_state(student))

    def post(self, request):
        student = get_object_or_404(CustomUser, pk=request.data.get('student'))
        ids = request.data.get('courses') or []
        if not isinstance(ids, list) or not ids:
            raise ValidationError({'courses': 'Choose at least one course.'})
        courses = list(Course.objects.filter(pk__in=ids))
        if len(courses) != len(set(map(str, ids))):
            raise ValidationError({'courses': 'Some of those courses no longer exist.'})
        expiry = _expiry(request.data.get('expiry_date'))

        from apps.dripping.services import DrippingService
        admitted = []
        for course in courses:
            enrollment, created = Enrollment.objects.get_or_create(
                student=student, course=course, defaults={'is_active': True, 'expiry_date': expiry})
            if not created:
                enrollment.is_active = True
                enrollment.expiry_date = expiry
                enrollment.save(update_fields=['is_active', 'expiry_date'])
            DrippingService(enrollment).unlock_all_eligible()
            admitted.append(course.title)
        return Response({'admitted': admitted, **_student_state(student)})


class StaffEnrollmentDetailView(APIView):
    permission_classes = [IsAdminOrManager]

    def patch(self, request, pk):
        enrollment = get_object_or_404(Enrollment.objects.select_related('course', 'student'), pk=pk)
        fields = []
        if 'is_active' in request.data:
            enrollment.is_active = bool(request.data['is_active'])
            fields.append('is_active')
        if 'expiry_date' in request.data:
            enrollment.expiry_date = _expiry(request.data['expiry_date'])
            fields.append('expiry_date')
        if fields:
            enrollment.save(update_fields=fields)
        return Response(_student_state(enrollment.student))

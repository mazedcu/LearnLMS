from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsInstructorOrAdmin(BasePermission):
    """Allow instructors and admins."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('instructor', 'admin')


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ('admin', 'manager')


class IsEnrolledOrInstructor(BasePermission):
    """Allow enrolled students, course instructor, or admin."""
    def has_permission(self, request, view):
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ('admin', 'manager'):
            return True
        # Determine course from obj
        course = getattr(obj, 'course', None) or getattr(getattr(obj, 'module', None), 'course', None)
        if course and course.instructor == user:
            return True
        from apps.courses.models import Enrollment
        return Enrollment.objects.filter(student=user, course=course, is_active=True).exists()


class ReadOnlyOrInstructorOwner(BasePermission):
    """Public read; write only for course owner or admin."""
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_authenticated and request.user.role in ('instructor', 'admin')

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if user.role == 'admin':
            return True
        course = getattr(obj, 'course', obj)
        return getattr(course, 'instructor', None) == user

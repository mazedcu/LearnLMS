from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import CustomUser, UserRole
from .serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer, TokenPairSerializer
from apps.common.permissions import IsAdmin
from rest_framework.throttling import ScopedRateThrottle
from . import security


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = TokenPairSerializer.get_tokens(user)
        return Response(tokens, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = str(request.data.get("email", ""))
        if security.is_locked(email):
            return Response(
                {"detail": f"Too many wrong passwords. Please wait {security.LOCK_MINUTES} minutes and try again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            security.record_failure(email)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        security.clear(email)
        user = serializer.validated_data["user"]
        tokens = TokenPairSerializer.get_tokens(user)
        return Response(tokens)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserListView(generics.ListAPIView):
    """Admin/Manager only — list all users."""
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role not in ("admin", "manager"):
            return CustomUser.objects.none()
        return CustomUser.objects.all().order_by('-date_joined')


class UserUpdateView(generics.UpdateAPIView):
    """Admin only — update a user's role or active status."""
    serializer_class = UserProfileSerializer
    permission_classes = [IsAdmin]
    queryset = CustomUser.objects.all()

    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        data = request.data
        errors = {}
        is_self = user.pk == request.user.pk

        if 'role' in data:
            if data['role'] not in UserRole.values:
                errors['role'] = f"Role must be one of: {', '.join(UserRole.values)}."
            elif is_self and data['role'] != UserRole.ADMIN:
                errors['role'] = "You can't remove your own admin role."
            else:
                user.role = data['role']

        if 'is_active' in data:
            value = data['is_active']
            active = value if isinstance(value, bool) else str(value).lower() in ('true', '1', 'yes')
            if is_self and not active:
                errors['is_active'] = "You can't disable your own account."
            else:
                user.is_active = active

        for field in ('first_name', 'last_name'):
            if field in data:
                setattr(user, field, str(data[field])[:150])

        if data.get('password'):
            try:
                validate_password(data['password'], user)
                user.set_password(data['password'])
            except DjangoValidationError as exc:
                errors['password'] = ' '.join(exc.messages)

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        user.save()
        return Response(UserProfileSerializer(user).data)


class UserDestroyView(generics.DestroyAPIView):
    """Admin only — delete a user."""
    queryset = CustomUser.objects.all()
    permission_classes = [IsAdmin]

    def destroy(self, request, *args, **kwargs):
        if self.get_object().pk == request.user.pk:
            return Response({'detail': "You can't delete your own account."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class PlatformStatsView(APIView):
    """Admin/Manager — platform-wide stats for dashboard overview."""
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.courses.models import Course, Enrollment
        from apps.payments.models import Order, OrderStatus
        from apps.certificates.models import Certificate

        return Response({
            'total_users':       CustomUser.objects.count(),
            'total_students':    CustomUser.objects.filter(role='student').count(),
            'total_instructors': CustomUser.objects.filter(role='instructor').count(),
            'total_courses':     Course.objects.count(),
            'published_courses': Course.objects.filter(status='published').count(),
            'total_enrollments': Enrollment.objects.filter(is_active=True).count(),
            'pending_payments':  Order.objects.filter(status=OrderStatus.SUBMITTED).count(),
            'total_certificates':Certificate.objects.count(),
        })

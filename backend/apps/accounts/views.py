from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from .models import CustomUser
from .serializers import RegisterSerializer, LoginSerializer, UserProfileSerializer, TokenPairSerializer
from apps.common.permissions import IsAdmin


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = TokenPairSerializer.get_tokens(user)
        return Response(tokens, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
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
        allowed = {k: v for k, v in request.data.items() if k in ('role', 'is_active', 'first_name', 'last_name')}
        for field, value in allowed.items():
            setattr(user, field, value)
        user.save()
        return Response(UserProfileSerializer(user).data)


class UserDestroyView(generics.DestroyAPIView):
    """Admin only — delete a user."""
    queryset = CustomUser.objects.all()
    permission_classes = [IsAdmin]


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

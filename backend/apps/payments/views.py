from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.common.permissions import IsAdmin
from .models import Order, OrderStatus
from .serializers import (
    OrderSerializer, CreateOrderSerializer,
    SubmitReferenceSerializer, VerifyOrderSerializer,
)


class CreateOrderView(generics.CreateAPIView):
    """Student initiates a purchase — creates an Order with status=pending."""
    serializer_class   = CreateOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        order = get_object_or_404(Order, pk=self.kwargs['pk'])
        user  = self.request.user
        if user.role not in ('admin', 'manager') and order.student != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied
        return order


class SubmitReferenceView(APIView):
    """Student submits their bKash/Nagad transaction reference."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(Order, pk=pk, student=request.user)
        if order.status not in (OrderStatus.PENDING, OrderStatus.SUBMITTED):
            return Response(
                {'detail': 'Order cannot be updated in its current state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SubmitReferenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order.payment_reference = serializer.validated_data['payment_reference']
        order.payment_method    = serializer.validated_data['payment_method']
        order.status = OrderStatus.SUBMITTED
        order.save()
        return Response(OrderSerializer(order).data)


class VerifyOrderView(APIView):
    """Admin verifies or rejects a submitted order."""
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        if order.status != OrderStatus.SUBMITTED:
            return Response(
                {'detail': 'Only submitted orders can be verified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = VerifyOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order.status      = serializer.validated_data['action']
        order.admin_note  = serializer.validated_data['admin_note']
        order.verified_by = request.user
        order.verified_at = timezone.now()
        order.save()  # triggers payment signal → enrollment + email

        return Response(OrderSerializer(order).data)


class PendingOrdersView(generics.ListAPIView):
    """Admin view of all submitted (awaiting verification) orders."""
    serializer_class   = OrderSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return (
            Order.objects
            .filter(status=OrderStatus.SUBMITTED)
            .select_related('student', 'course')
            .order_by('created_at')
        )


class MyOrdersView(generics.ListAPIView):
    """Student's own order history."""
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(student=self.request.user).order_by('-created_at')

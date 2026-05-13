from django.urls import path
from .views import (
    CreateOrderView, OrderDetailView, SubmitReferenceView,
    VerifyOrderView, PendingOrdersView, MyOrdersView,
)

app_name = 'payments'

urlpatterns = [
    path('orders/', CreateOrderView.as_view(), name='create-order'),
    path('orders/pending/', PendingOrdersView.as_view(), name='pending-orders'),
    path('orders/my/', MyOrdersView.as_view(), name='my-orders'),
    path('orders/<uuid:pk>/', OrderDetailView.as_view(), name='order-detail'),
    path('orders/<uuid:pk>/reference/', SubmitReferenceView.as_view(), name='submit-reference'),
    path('orders/<uuid:pk>/verify/', VerifyOrderView.as_view(), name='verify-order'),
]

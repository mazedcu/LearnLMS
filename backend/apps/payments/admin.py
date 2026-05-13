from django.contrib import admin
from django.utils import timezone
from .models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display  = ['student', 'course', 'amount', 'payment_method', 'status', 'created_at']
    list_filter   = ['status', 'payment_method']
    search_fields = ['student__email', 'course__title', 'payment_reference']
    readonly_fields = ['id', 'created_at', 'updated_at', 'verified_at']
    actions = ['verify_orders', 'reject_orders']

    def verify_orders(self, request, queryset):
        for order in queryset.filter(status='submitted'):
            order.status      = 'verified'
            order.verified_by = request.user
            order.verified_at = timezone.now()
            order.save()
    verify_orders.short_description = 'Verify selected submitted orders'

    def reject_orders(self, request, queryset):
        queryset.filter(status='submitted').update(status='rejected')
    reject_orders.short_description = 'Reject selected submitted orders'

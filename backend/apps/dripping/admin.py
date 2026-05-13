from django.contrib import admin
from .models import DrippingRule, ContentAccess


@admin.register(DrippingRule)
class DrippingRuleAdmin(admin.ModelAdmin):
    list_display  = ['lesson', 'criteria_type', 'unlock_after_days', 'required_score', 'is_globally_locked']
    list_filter   = ['criteria_type']
    search_fields = ['lesson__title']


@admin.register(ContentAccess)
class ContentAccessAdmin(admin.ModelAdmin):
    list_display  = ['enrollment', 'lesson', 'is_unlocked', 'unlocked_at', 'unlock_reason']
    list_filter   = ['is_unlocked', 'unlock_reason']
    search_fields = ['enrollment__student__email', 'lesson__title']
    actions       = ['unlock_selected']

    def unlock_selected(self, request, queryset):
        from django.utils import timezone
        queryset.update(is_unlocked=True, unlocked_at=timezone.now(), unlock_reason='admin_bulk')
    unlock_selected.short_description = 'Unlock selected content access records'

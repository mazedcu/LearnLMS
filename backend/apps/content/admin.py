from django.contrib import admin
from .models import ContentBlock


@admin.register(ContentBlock)
class ContentBlockAdmin(admin.ModelAdmin):
    list_display  = ['lesson', 'block_type', 'order', 'is_fullscreen', 'title']
    list_filter   = ['block_type', 'is_fullscreen']
    search_fields = ['lesson__title', 'title']
    ordering      = ['lesson', 'order']

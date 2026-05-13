from django.contrib import admin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ["email", "username", "role", "is_active", "date_joined"]
    list_filter = ["role", "is_active"]
    search_fields = ["email", "username", "first_name", "last_name"]
    ordering = ["-date_joined"]
    readonly_fields = ["id", "date_joined"]
    fieldsets = (
        ("Identity", {"fields": ("id", "email", "username", "password")}),
        ("Personal", {"fields": ("first_name", "last_name", "avatar", "bio", "phone")}),
        ("Role & Status", {"fields": ("role", "is_active", "is_staff", "is_superuser")}),
        ("Timestamps", {"fields": ("date_joined",)}),
    )

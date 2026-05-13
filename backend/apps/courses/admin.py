from django.contrib import admin
from .models import Course, Module, Lesson, Enrollment


class ModuleInline(admin.TabularInline):
    model = Module
    extra = 0
    show_change_link = True


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0
    show_change_link = True


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display   = ['title', 'instructor', 'price', 'status', 'created_at']
    list_filter    = ['status', 'language']
    search_fields  = ['title', 'instructor__email']
    prepopulated_fields = {'slug': ('title',)}
    inlines        = [ModuleInline]
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display  = ['title', 'course', 'order']
    list_filter   = ['course']
    inlines       = [LessonInline]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display  = ['title', 'module', 'order', 'is_published', 'is_preview']
    list_filter   = ['is_published', 'is_preview']
    search_fields = ['title']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display  = ['student', 'course', 'enrolled_at', 'is_active']
    list_filter   = ['is_active']
    search_fields = ['student__email', 'course__title']
    readonly_fields = ['id', 'enrolled_at']

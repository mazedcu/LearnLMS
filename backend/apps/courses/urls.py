from django.urls import path
from .views import (
    CourseListCreateView, CourseDetailView,
    ModuleListCreateView, ModuleDetailView,
    LessonListCreateView, LessonDetailView,
    EnrollView, MyEnrollmentsView,
)

app_name = 'courses'

urlpatterns = [
    path('', CourseListCreateView.as_view(), name='course-list'),
    path('my-enrollments/', MyEnrollmentsView.as_view(), name='my-enrollments'),
    path('<slug:slug>/', CourseDetailView.as_view(), name='course-detail'),
    path('<slug:slug>/modules/', ModuleListCreateView.as_view(), name='module-list'),
    path('<slug:slug>/enroll/', EnrollView.as_view(), name='course-enroll'),
    path('modules/<uuid:pk>/', ModuleDetailView.as_view(), name='module-detail'),
    path('modules/<uuid:module_pk>/lessons/', LessonListCreateView.as_view(), name='lesson-list'),
    path('lessons/<uuid:pk>/', LessonDetailView.as_view(), name='lesson-detail'),
]

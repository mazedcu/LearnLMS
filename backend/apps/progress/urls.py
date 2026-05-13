from django.urls import path
from .views import CourseProgressView, StudentAnalyticsView, CourseAnalyticsView

app_name = 'progress'

urlpatterns = [
    path('enrollment/<uuid:enrollment_pk>/', CourseProgressView.as_view(), name='course-progress'),
    path('student/<uuid:user_pk>/', StudentAnalyticsView.as_view(), name='student-analytics'),
    path('course/<slug:slug>/', CourseAnalyticsView.as_view(), name='course-analytics'),
]

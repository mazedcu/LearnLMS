from django.urls import path
from .views import (
    CourseProgressView, StudentAnalyticsView, CourseAnalyticsView,
    AdminUserActivityReportView, AdminQuizResultsReportView, AdminRecentActivityView,
)

app_name = 'progress'

urlpatterns = [
    path('enrollment/<uuid:enrollment_pk>/', CourseProgressView.as_view(), name='course-progress'),
    path('student/<uuid:user_pk>/', StudentAnalyticsView.as_view(), name='student-analytics'),
    path('course/<slug:slug>/', CourseAnalyticsView.as_view(), name='course-analytics'),
    path('admin/reports/users/', AdminUserActivityReportView.as_view(), name='admin-user-report'),
    path('admin/reports/quizzes/', AdminQuizResultsReportView.as_view(), name='admin-quiz-report'),
    path('admin/reports/recent/', AdminRecentActivityView.as_view(), name='admin-recent-activity'),
]

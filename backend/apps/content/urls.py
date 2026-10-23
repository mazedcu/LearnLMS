from django.urls import path
from .views import (
    ContentBlockListCreateView, ContentBlockDetailView,
    LessonDetailView, LessonCompleteView, LessonDripStatusView, H5PServeView,
    CourseLessonStatusView,
)

app_name = 'content'

urlpatterns = [
    path('lessons/<uuid:lesson_pk>/', LessonDetailView.as_view(), name='lesson-detail'),
    path('lessons/<uuid:lesson_pk>/blocks/', ContentBlockListCreateView.as_view(), name='block-list'),
    path('lessons/<uuid:lesson_pk>/complete/', LessonCompleteView.as_view(), name='lesson-complete'),
    path('lessons/<uuid:lesson_pk>/drip-status/', LessonDripStatusView.as_view(), name='drip-status'),
    path('courses/<slug:slug>/lesson-status/', CourseLessonStatusView.as_view(), name='course-lesson-status'),
    path('blocks/<uuid:pk>/', ContentBlockDetailView.as_view(), name='block-detail'),
    path('h5p/<uuid:block_id>/', H5PServeView.as_view(), name='h5p-serve'),
]

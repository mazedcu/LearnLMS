from django.urls import path
from .views import VideoListCreateView, VideoDetailView, VideoEmbedView, VideoStreamView

urlpatterns = [
    path("videos/",           VideoListCreateView.as_view(), name="video-list"),
    path("videos/<uuid:pk>/", VideoDetailView.as_view(),    name="video-detail"),
    path("videos/<uuid:pk>/embed/",  VideoEmbedView.as_view(),  name="video-embed"),
    path("videos/<uuid:pk>/stream/", VideoStreamView.as_view(), name="video-stream"),
]

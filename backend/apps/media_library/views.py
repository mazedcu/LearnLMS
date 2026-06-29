from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import StreamingHttpResponse, Http404
import os

from .models import VideoLibrary
from .serializers import VideoLibrarySerializer
from apps.common.permissions import IsAdminOrManager


def _stream_video(request, video):
    """Stream video file with range request support."""
    file_path = video.file.path
    if not os.path.exists(file_path):
        raise Http404("Video file not found.")

    file_size = os.path.getsize(file_path)
    range_header = request.META.get("HTTP_RANGE", "").strip()
    content_type = "video/mp4"

    # Detect content type from extension
    ext = os.path.splitext(file_path)[1].lower()
    mime_map = {
        ".mp4": "video/mp4", ".webm": "video/webm",
        ".ogg": "video/ogg", ".mov": "video/quicktime",
        ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
    }
    content_type = mime_map.get(ext, "video/mp4")

    if range_header.startswith("bytes="):
        try:
            byte_range = range_header[6:].split("-")
            start = int(byte_range[0])
            end   = int(byte_range[1]) if byte_range[1] else file_size - 1
        except (ValueError, IndexError):
            start, end = 0, file_size - 1

        chunk_size = end - start + 1

        def file_iterator(path, offset, length, chunk=65536):
            with open(path, "rb") as f:
                f.seek(offset)
                remaining = length
                while remaining > 0:
                    data = f.read(min(chunk, remaining))
                    if not data:
                        break
                    yield data
                    remaining -= len(data)

        response = StreamingHttpResponse(
            file_iterator(file_path, start, chunk_size),
            status=206, content_type=content_type,
        )
        response["Content-Range"]  = f"bytes {start}-{end}/{file_size}"
        response["Content-Length"] = chunk_size
        response["Accept-Ranges"]  = "bytes"
        return response

    # Full file response
    def full_iterator(path, chunk=65536):
        with open(path, "rb") as f:
            while True:
                data = f.read(chunk)
                if not data:
                    break
                yield data

    response = StreamingHttpResponse(
        full_iterator(file_path), content_type=content_type,
    )
    response["Content-Length"] = file_size
    response["Accept-Ranges"]  = "bytes"
    return response


class VideoListCreateView(generics.ListCreateAPIView):
    queryset         = VideoLibrary.objects.all()
    serializer_class = VideoLibrarySerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAdminOrManager()]
        return [IsAdminOrManager()]   # listing also admin-only

    def perform_create(self, serializer):
        file = self.request.FILES.get("file")
        serializer.save(size_bytes=file.size if file else 0)


class VideoDetailView(generics.RetrieveDestroyAPIView):
    queryset         = VideoLibrary.objects.all()
    serializer_class = VideoLibrarySerializer
    permission_classes = [IsAdminOrManager]


class VideoEmbedView(APIView):
    """Serve an embeddable player page — audio or video depending on media_type."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        video = get_object_or_404(VideoLibrary, pk=pk)
        file_url = request.build_absolute_uri(video.file.url)

        if video.media_type == "audio":
            html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{
      background: linear-gradient(135deg,#1E1B4B,#312E81);
      display: flex; align-items: center; justify-content: center;
      height: 100vh; font-family: system-ui, sans-serif;
      padding: 1rem;
    }}
    .player {{
      background: rgba(255,255,255,0.08);
      backdrop-filter: blur(20px);
      border-radius: 16px;
      padding: 1.5rem 2rem;
      width: 100%; max-width: 540px;
      border: 1px solid rgba(255,255,255,0.15);
    }}
    h3 {{
      color: #fff; font-size: 1rem; margin-bottom: 1rem;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }}
    audio {{ width: 100%; outline: none; border-radius: 8px; }}
  </style>
</head>
<body>
  <div class="player">
    <h3>🎵 {video.title}</h3>
    <audio controls autoplay>
      <source src="{file_url}">
      Your browser does not support the audio tag.
    </audio>
  </div>
</body>
</html>"""
        else:
            html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {{ margin:0; padding:0; box-sizing:border-box; }}
    body {{ background:#000; display:flex; align-items:center; justify-content:center; height:100vh; }}
    video {{ width:100%; max-height:100vh; outline:none; }}
  </style>
</head>
<body>
  <video controls autoplay playsinline preload="metadata">
    <source src="{file_url}">
    Your browser does not support the video tag.
  </video>
</body>
</html>"""

        from django.http import HttpResponse
        return HttpResponse(html, content_type="text/html")



class VideoStreamView(APIView):
    """Stream the raw video file with range-request support."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        video = get_object_or_404(VideoLibrary, pk=pk)
        return _stream_video(request, video)

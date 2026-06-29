import uuid
from django.db import models


class VideoLibrary(models.Model):
    MEDIA_TYPE_CHOICES = [("video", "Video"), ("audio", "Audio")]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    file        = models.FileField(upload_to="media_library/")
    media_type  = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES, default="video")
    size_bytes  = models.BigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "Media File"
        verbose_name_plural = "Media Files"

    def __str__(self):
        return f"[{self.media_type.upper()}] {self.title}"

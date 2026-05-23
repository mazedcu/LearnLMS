import uuid
import os
import zipfile
from django.db import models
from django.conf import settings


class BlockType(models.TextChoices):
    HTML = 'html', 'HTML Block'
    VIDEO = 'video', 'Video'
    H5P = 'h5p', 'H5P (Moodle)'
    DOCUMENT = 'document', 'Document / PDF'
    IMAGE = 'image', 'Image'


class ContentBlock(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(
        'courses.Lesson', on_delete=models.CASCADE, related_name='content_blocks'
    )
    block_type = models.CharField(max_length=20, choices=BlockType.choices)
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255, blank=True)

    # HTML block
    html_content = models.TextField(blank=True, help_text='Raw HTML content')
    is_fullscreen = models.BooleanField(default=False, help_text='Render HTML block fullscreen')

    # File-based blocks (video, document, image)
    file = models.FileField(upload_to='content_files/', blank=True, null=True)

    # H5P embed from Moodle
    h5p_embed_url = models.URLField(blank=True, help_text='Moodle H5P embed.php URL')
    moodle_resource_id = models.PositiveIntegerField(null=True, blank=True)
    h5p_extracted_path = models.CharField(max_length=255, blank=True, help_text='Path to extracted H5P content')

    # Video (external)
    video_url = models.URLField(blank=True, help_text='YouTube / Vimeo embed URL')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.lesson.title} — {self.block_type} (#{self.order})'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Extract H5P file if uploaded
        if self.block_type == 'h5p' and self.file and not self.h5p_extracted_path:
            self._extract_h5p()

    def _extract_h5p(self):
        """Extract .h5p file to media directory for serving."""
        if not self.file:
            return

        try:
            # Create extraction directory
            extract_dir = os.path.join(settings.MEDIA_ROOT, 'h5p_extracted', str(self.id))
            os.makedirs(extract_dir, exist_ok=True)

            # Extract the ZIP file
            with zipfile.ZipFile(self.file.path, 'r') as zip_ref:
                zip_ref.extractall(extract_dir)

            # Store relative path
            self.h5p_extracted_path = f'h5p_extracted/{self.id}'
            # Save without triggering another extraction
            super().save(update_fields=['h5p_extracted_path'])
        except Exception as e:
            # Log error but don't fail the save
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to extract H5P file for block {self.id}: {e}")

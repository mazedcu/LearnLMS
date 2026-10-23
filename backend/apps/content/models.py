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
        # Did the uploaded file change? (new block, replaced or removed file)
        old_file = None
        if self.pk:
            old_file = (
                ContentBlock.objects.filter(pk=self.pk).values_list('file', flat=True).first()
            )
        file_changed = (old_file or '') != (self.file.name if self.file else '')
        super().save(*args, **kwargs)

        if self.block_type != 'h5p':
            return
        if self.file and (file_changed or not self.h5p_extracted_path):
            self._extract_h5p()
        elif not self.file and self.h5p_extracted_path:
            # Switched to an embed link: drop the old unpacked package
            from .h5p import remove_extracted
            remove_extracted(self.id)
            self.h5p_extracted_path = ''
            super().save(update_fields=['h5p_extracted_path'])

    def _extract_h5p(self):
        """Unpack the .h5p file so the student page can play it."""
        from .h5p import extract_package
        try:
            self.h5p_extracted_path = extract_package(self)
            super().save(update_fields=['h5p_extracted_path'])
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to extract H5P file for block %s", self.id)

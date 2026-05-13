import uuid
from django.db import models


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

    # Video (external)
    video_url = models.URLField(blank=True, help_text='YouTube / Vimeo embed URL')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.lesson.title} — {self.block_type} (#{self.order})'

from rest_framework import serializers
from .models import ContentBlock


class ContentBlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentBlock
        fields = [
            'id', 'lesson', 'block_type', 'order', 'title',
            'html_content', 'is_fullscreen',
            'file', 'h5p_embed_url', 'moodle_resource_id',
            'video_url', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ContentBlockWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentBlock
        fields = [
            'block_type', 'order', 'title',
            'html_content', 'is_fullscreen',
            'file', 'h5p_embed_url', 'moodle_resource_id', 'video_url',
        ]

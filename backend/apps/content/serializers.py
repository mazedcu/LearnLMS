from rest_framework import serializers
from .models import ContentBlock


class ContentBlockSerializer(serializers.ModelSerializer):
    h5p_internal_url = serializers.SerializerMethodField()

    class Meta:
        model = ContentBlock
        fields = [
            'id', 'lesson', 'block_type', 'order', 'title',
            'html_content', 'is_fullscreen',
            'file', 'h5p_embed_url', 'moodle_resource_id', 'h5p_extracted_path',
            'h5p_internal_url', 'video_url', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'h5p_extracted_path', 'h5p_internal_url']

    def get_h5p_internal_url(self, obj):
        if obj.block_type == 'h5p' and (obj.file or obj.h5p_extracted_path):
            return f'/api/content/h5p/{obj.id}/'
        return None


class ContentBlockWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentBlock
        fields = [
            'block_type', 'order', 'title',
            'html_content', 'is_fullscreen',
            'file', 'h5p_embed_url', 'moodle_resource_id', 'video_url',
        ]

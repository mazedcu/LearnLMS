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
            'h5p_internal_url', 'video_url', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'h5p_extracted_path', 'h5p_internal_url']

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

    def validate(self, data):
        block_type = data.get('block_type') or getattr(self.instance, 'block_type', None)
        upload = data.get('file')
        if block_type == 'h5p' and upload:
            if not upload.name.lower().endswith('.h5p'):
                raise serializers.ValidationError({'file': 'Upload a .h5p file for an H5P activity.'})
            from .h5p import inspect_package, H5PPackageError
            try:
                meta = inspect_package(upload)
            except H5PPackageError as exc:
                raise serializers.ValidationError({'file': str(exc)})
            # Use the activity's own title when the teacher didn't give one
            if not (data.get('title') or getattr(self.instance, 'title', '')):
                data['title'] = (meta.get('title') or '')[:255]
        return data

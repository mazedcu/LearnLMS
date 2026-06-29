from rest_framework import serializers
from .models import VideoLibrary


class VideoLibrarySerializer(serializers.ModelSerializer):
    file_url   = serializers.SerializerMethodField()
    embed_url  = serializers.SerializerMethodField()
    embed_code = serializers.SerializerMethodField()
    size_mb    = serializers.SerializerMethodField()

    class Meta:
        model  = VideoLibrary
        fields = [
            'id', 'title', 'description', 'file',
            'file_url', 'embed_url', 'embed_code',
            'size_bytes', 'size_mb', 'uploaded_at',
        ]
        read_only_fields = ['id', 'uploaded_at', 'size_bytes']

    def _base_url(self):
        request = self.context.get('request')
        if request:
            return f"{request.scheme}://{request.get_host()}"
        return ""

    def get_file_url(self, obj):
        request = self.context.get('request')
        if request and obj.file:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url if obj.file else ""

    def get_embed_url(self, obj):
        request = self.context.get('request')
        if request and obj.file:
            return request.build_absolute_uri(f"/api/media/videos/{obj.id}/embed/")
        return ""

    def get_embed_code(self, obj):
        embed_url = self.get_embed_url(obj)
        return (
            f'<iframe src="{embed_url}" '
            f'width="100%" height="450" '
            f'frameborder="0" allowfullscreen '
            f'allow="autoplay; fullscreen"></iframe>'
        )

    def get_size_mb(self, obj):
        if obj.size_bytes:
            return round(obj.size_bytes / (1024 * 1024), 2)
        return 0

    def create(self, validated_data):
        file = validated_data.get('file')
        if file:
            validated_data['size_bytes'] = file.size
        return super().create(validated_data)

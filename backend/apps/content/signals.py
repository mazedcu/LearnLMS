from django.db.models.signals import post_delete
from django.dispatch import receiver


@receiver(post_delete, sender='content.ContentBlock')
def remove_h5p_files(sender, instance, **kwargs):
    """Delete a block's unpacked H5P folder along with the block."""
    if instance.block_type == 'h5p':
        from .h5p import remove_extracted
        remove_extracted(instance.id)

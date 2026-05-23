import os
import django
from django.conf import settings

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

print(f"MOODLE_BASE_URL: {settings.MOODLE_BASE_URL}")
print(f"MOODLE_SERVICE_TOKEN: '{settings.MOODLE_SERVICE_TOKEN}'")
print(f"Token length: {len(settings.MOODLE_SERVICE_TOKEN)}")

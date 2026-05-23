"""
Run this script to create/reset a superuser.
Usage:  cd backend
        .\venv\Scripts\activate
        python create_admin.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser, UserRole

EMAIL = 'admin@learnlms.com'
PASSWORD = 'Admin@123'
USERNAME = 'admin'

user, created = CustomUser.objects.get_or_create(
    email=EMAIL,
    defaults={
        'username': USERNAME,
        'first_name': 'Admin',
        'last_name': 'User',
        'role': UserRole.ADMIN,
        'is_staff': True,
        'is_superuser': True,
        'is_active': True,
    }
)

if not created:
    user.is_staff = True
    user.is_superuser = True
    user.role = UserRole.ADMIN
    user.is_active = True

user.set_password(PASSWORD)
user.save()

status = "Created" if created else "Reset"
print(f"\n{'='*40}")
print(f"  Superuser {status} Successfully!")
print(f"{'='*40}")
print(f"  Email:    {EMAIL}")
print(f"  Password: {PASSWORD}")
print(f"{'='*40}\n")

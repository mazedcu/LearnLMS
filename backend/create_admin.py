"""
Create or reset the admin account. Asks for the password (never stored here).
Usage:  cd backend
        source venv/bin/activate      (Windows: .\venv\Scripts\activate)
        python create_admin.py
Optional: ADMIN_EMAIL / ADMIN_USERNAME environment variables.
"""
import getpass
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser, UserRole

EMAIL = os.environ.get('ADMIN_EMAIL') or input('Admin email: ').strip()
USERNAME = os.environ.get('ADMIN_USERNAME') or EMAIL.split('@')[0]
PASSWORD = getpass.getpass('New admin password: ')
if len(PASSWORD) < 10 or PASSWORD != getpass.getpass('Repeat password: '):
    raise SystemExit('Passwords must match and be at least 10 characters.')

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
print(f"{'='*40}\n")

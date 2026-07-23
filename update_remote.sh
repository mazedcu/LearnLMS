cd /var/www/learnwithhasan/backend
source venv/bin/activate
cat << 'EOF' > update_admin.py
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import CustomUser, UserRole

EMAIL = 'mazedcu@gmail.com'
PASSWORD = '114598Maryamamarmae'
USERNAME = 'mazedcu'

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
print("Superuser created/updated successfully on the droplet!")
EOF
python update_admin.py

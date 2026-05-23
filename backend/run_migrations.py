import os
import django
import glob
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# 1. Cleanup old broken migrations
print("Cleaning up old migrations for assessments...")
migration_dir = os.path.join('apps', 'assessments', 'migrations')
files = glob.glob(os.path.join(migration_dir, '00*.py'))
for f in files:
    try:
        os.remove(f)
        print(f"Deleted {f}")
    except Exception as e:
        print(f"Error deleting {f}: {e}")

# Ensure __init__.py exists
init_file = os.path.join(migration_dir, '__init__.py')
if not os.path.exists(init_file):
    with open(init_file, 'w') as f:
        pass

# 2. Generate clean initial migration
print("Generating fresh initial migration for assessments...")
call_command('makemigrations', 'assessments')

# 3. Apply migrations
print("Applying migrations...")
# We use --fake-initial if needed, but since the tables don't exist, a normal migrate should work.
# If there's a record in django_migrations for '0001_initial', we might need to clear it.
from django.db import connection
with connection.cursor() as cursor:
    cursor.execute("DELETE FROM django_migrations WHERE app='assessments'")
    print("Cleared migration history for assessments.")

call_command('migrate', 'assessments')

print("\nMigrations applied successfully! You can now save assessments.")

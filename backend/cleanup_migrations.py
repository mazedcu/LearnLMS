import os
import glob

migration_dir = r'c:\Users\DEVICE NAGAR\Desktop\LMS\backend\apps\assessments\migrations'
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
    print("Created __init__.py")

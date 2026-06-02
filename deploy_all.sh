#!/bin/bash
set -e

cd /var/www/learnwithhasan
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv python3-pip npm

echo "Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt gunicorn
echo "SECRET_KEY='super_secret_key'" > .env
echo "DEBUG=False" >> .env
echo "ALLOWED_HOSTS='104.248.226.234,localhost,127.0.0.1'" >> .env
python manage.py migrate
python manage.py collectstatic --noinput

echo "Setting up frontend..."
cd ../frontend
npm install
npm run build

echo "Deployment scripts finished successfully!"

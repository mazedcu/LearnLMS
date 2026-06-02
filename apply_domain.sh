#!/bin/bash
sed -i "s/ALLOWED_HOSTS='/ALLOWED_HOSTS='learnwithhasan.xyz,www.learnwithhasan.xyz,/" /var/www/learnwithhasan/backend/.env
cp /root/learnwithhasan_nginx.conf /etc/nginx/sites-available/learnwithhasan
systemctl reload nginx
systemctl restart learnwithhasan

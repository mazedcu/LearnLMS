"""Login protection: per-account lockout after repeated wrong passwords."""
import tempfile

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.accounts import security

CACHE = {'default': {'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
                     'LOCATION': tempfile.mkdtemp(prefix='lms-cache-')}}


@override_settings(CACHES=CACHE)
class LoginLockoutTests(TestCase):
    def setUp(self):
        cache.clear()
        CustomUser.objects.create_user(email='s@x.com', username='s', password='right-pass-1', role='student')
        self.c = APIClient()

    def login(self, password, email='s@x.com', ip='10.0.0.1'):
        return self.c.post('/api/auth/login/', {'email': email, 'password': password},
                           format='json', HTTP_X_FORWARDED_FOR=ip)

    def test_account_locks_after_repeated_wrong_passwords(self):
        for _ in range(security.LOCK_AFTER):
            self.assertEqual(self.login('wrong').status_code, 400)
        r = self.login('right-pass-1')  # even the right password waits now
        self.assertEqual(r.status_code, 429)
        self.assertIn('wait', r.json()['detail'])

    def test_success_resets_the_counter(self):
        for _ in range(security.LOCK_AFTER - 1):
            self.login('wrong')
        self.assertEqual(self.login('right-pass-1').status_code, 200)
        for _ in range(security.LOCK_AFTER - 1):
            self.login('wrong')
        self.assertEqual(self.login('right-pass-1').status_code, 200)

    def test_a_class_on_one_ip_can_all_sign_in(self):
        for i in range(40):
            CustomUser.objects.create_user(email=f'k{i}@x.com', username=f'k{i}', password='class-pass-1', role='student')
        codes = {self.login('class-pass-1', email=f'k{i}@x.com', ip='203.0.113.5').status_code for i in range(40)}
        self.assertEqual(codes, {200})

    def test_lockout_is_per_account(self):
        for _ in range(security.LOCK_AFTER):
            self.login('wrong', email='attacker-target@x.com')
        self.assertEqual(self.login('right-pass-1').status_code, 200)

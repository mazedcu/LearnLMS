"""Tests for payment settings and duplicate transaction references."""
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser
from apps.courses.models import Course
from apps.payments.models import Order


class PaymentSettingsTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create_user(email='a@x.com', username='a', password='pw', role='admin')
        self.student = CustomUser.objects.create_user(email='s@x.com', username='s', password='pw', role='student')

    def test_anyone_can_read_default_numbers(self):
        data = APIClient().get('/api/payments/settings/').json()
        self.assertEqual(data['bkash_number'], '01676885195')
        self.assertEqual(data['nagad_number'], '01676885195')

    def test_only_admin_can_change_numbers(self):
        c = APIClient(); c.force_authenticate(self.student)
        self.assertEqual(c.patch('/api/payments/settings/', {'bkash_number': '01700000000'}, format='json').status_code, 403)
        c.force_authenticate(self.admin)
        r = c.patch('/api/payments/settings/', {'nagad_number': ' 01811111111 '}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(APIClient().get('/api/payments/settings/').json()['nagad_number'], '01811111111')
        r = c.patch('/api/payments/settings/', {'bkash_number': 'call me'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_admin_sees_reused_transaction_reference(self):
        course = Course.objects.create(title='C', slug='c', instructor=self.admin, status='published', price=500)
        other = CustomUser.objects.create_user(email='o@x.com', username='o', password='pw', role='student')
        Order.objects.create(student=other, course=course, amount=500, payment_reference='ABC123', status='verified')
        order = Order.objects.create(student=self.student, course=course, amount=500)
        c = APIClient(); c.force_authenticate(self.student)
        c.post(f'/api/payments/orders/{order.id}/reference/', {'payment_reference': ' abc123 ', 'payment_method': 'bkash'}, format='json')
        c.force_authenticate(self.admin)
        pending = c.get('/api/payments/orders/pending/').json()
        pending = pending if isinstance(pending, list) else pending['results']
        self.assertEqual(pending[0]['payment_reference'], 'ABC123')
        self.assertEqual(pending[0]['reference_used_on'][0]['student_email'], 'o@x.com')

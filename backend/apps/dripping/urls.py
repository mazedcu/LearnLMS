from django.urls import path
from .views import DrippingRuleView, DrippingRuleCreateView, ManualUnlockView, EvaluateDripView

app_name = 'dripping'

urlpatterns = [
    path('rules/', DrippingRuleCreateView.as_view(), name='rule-create'),
    path('rules/<uuid:lesson_pk>/', DrippingRuleView.as_view(), name='rule-detail'),
    path('unlock/<uuid:lesson_pk>/', ManualUnlockView.as_view(), name='manual-unlock'),
    path('evaluate/<uuid:enrollment_pk>/', EvaluateDripView.as_view(), name='evaluate'),
]

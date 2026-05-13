from django.urls import path
from .views import MyCertificatesView, CertificateDownloadView, CertificateVerifyView

app_name = 'certificates'

urlpatterns = [
    path('', MyCertificatesView.as_view(), name='my-certificates'),
    path('<uuid:pk>/download/', CertificateDownloadView.as_view(), name='download'),
    path('verify/<uuid:uuid>/', CertificateVerifyView.as_view(), name='verify'),
]

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/courses/", include("apps.courses.urls")),
    path("api/content/", include("apps.content.urls")),
    path("api/drip/", include("apps.dripping.urls")),
    path("api/assessments/", include("apps.assessments.urls")),
    path("api/payments/", include("apps.payments.urls")),
    path("api/progress/", include("apps.progress.urls")),
    path("api/certificates/", include("apps.certificates.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

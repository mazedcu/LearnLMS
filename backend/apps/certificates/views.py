import os
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse
from django.shortcuts import get_object_or_404

from .models import Certificate
from .serializers import CertificateSerializer


class MyCertificatesView(generics.ListAPIView):
    serializer_class   = CertificateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Certificate.objects.filter(
            enrollment__student=self.request.user
        ).select_related('enrollment__course', 'enrollment__student')


class CertificateDownloadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        cert = get_object_or_404(Certificate, pk=pk, enrollment__student=request.user)
        if not cert.pdf_file:
            return Response({'detail': 'PDF not yet generated.'}, status=404)
        return FileResponse(cert.pdf_file.open('rb'), content_type='application/pdf',
                            as_attachment=True, filename=f'certificate_{cert.certificate_number}.pdf')


class CertificateVerifyView(APIView):
    """Public endpoint to verify a certificate by UUID."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, uuid):
        cert = get_object_or_404(
            Certificate.objects.select_related('enrollment__student', 'enrollment__course'),
            certificate_number=uuid,
        )
        return Response(CertificateSerializer(cert).data)

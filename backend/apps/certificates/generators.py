"""
Certificate PDF Generator
--------------------------
Uses WeasyPrint to render an HTML template to PDF.
Falls back to a plain text notice if WeasyPrint is unavailable.
"""
import logging
import os

from django.conf import settings
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)


def generate_certificate_pdf(certificate) -> bool:
    """
    Render certificate HTML template → PDF and save to certificate.pdf_file.
    Returns True on success, False on failure.
    """
    try:
        from weasyprint import HTML, CSS
    except ImportError:
        logger.warning("WeasyPrint not installed. Skipping PDF generation.")
        return False

    context = {
        "student_name": certificate.enrollment.student.full_name,
        "course_title": certificate.enrollment.course.title,
        "issued_at": certificate.issued_at,
        "certificate_number": str(certificate.certificate_number),
        "verification_url": certificate.verification_url,
        "instructor_name": (
            certificate.enrollment.course.instructor.full_name
            if certificate.enrollment.course.instructor
            else "LMS Team"
        ),
    }

    html_string = render_to_string("certificates/certificate.html", context)

    # Save to media directory
    filename = f"certificate_{certificate.certificate_number}.pdf"
    output_dir = os.path.join(settings.MEDIA_ROOT, "certificates")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, filename)

    try:
        HTML(string=html_string, base_url=settings.MEDIA_ROOT).write_pdf(output_path)
        certificate.pdf_file.name = f"certificates/{filename}"
        certificate.save(update_fields=["pdf_file"])
        logger.info("Certificate PDF saved: %s", output_path)
        return True
    except Exception as exc:
        logger.error("WeasyPrint rendering failed: %s", exc)
        return False

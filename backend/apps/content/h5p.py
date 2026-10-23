"""
H5P package handling
--------------------
An .h5p file is a zip containing ``h5p.json`` (metadata), ``content/`` (the
activity's data) and one folder per library it needs (e.g. ``H5P.TrueFalse-1.6``).
The student page plays it with h5p-standalone straight from the extracted
folder, so every library must be inside the package.
"""
import json
import logging
import os
import shutil
import zipfile

from django.conf import settings

logger = logging.getLogger(__name__)

MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024  # 1 GB, guards against zip bombs


class H5PPackageError(ValueError):
    """The uploaded file is not a playable H5P package. Message is user-facing."""


def _library_folder(dep):
    return f"{dep.get('machineName')}-{dep.get('majorVersion')}.{dep.get('minorVersion')}"


def inspect_package(fileobj):
    """Check an uploaded .h5p file and return its h5p.json metadata.

    Raises H5PPackageError with a teacher-friendly message when the file
    can't be played.
    """
    try:
        pos = fileobj.tell()
    except Exception:
        pos = None
    try:
        with zipfile.ZipFile(fileobj) as zf:
            names = zf.namelist()
            if "h5p.json" not in names:
                raise H5PPackageError("This isn't an H5P package (h5p.json is missing). Export the activity as a .h5p file and try again.")
            if not any(n.startswith("content/") for n in names):
                raise H5PPackageError("This H5P package has no content folder, so there's nothing to show.")
            total = sum(i.file_size for i in zf.infolist())
            if total > MAX_UNCOMPRESSED_BYTES:
                raise H5PPackageError("This H5P package is too large once unpacked (over 1 GB).")
            for n in names:
                if n.startswith("/") or ".." in n.replace("\\", "/").split("/"):
                    raise H5PPackageError("This H5P package contains unsafe file paths.")
            try:
                meta = json.loads(zf.read("h5p.json").decode("utf-8-sig"))
            except Exception:
                raise H5PPackageError("This H5P package's h5p.json can't be read.")

            folders = {n.split("/")[0] for n in names}
            deps = list(meta.get("preloadedDependencies") or [])
            main = meta.get("mainLibrary")
            missing = [_library_folder(d) for d in deps if _library_folder(d) not in folders]
            if not main:
                raise H5PPackageError("This H5P package doesn't say which activity type it is (mainLibrary missing).")
            if missing:
                raise H5PPackageError(
                    "This H5P file doesn't include the libraries it needs "
                    f"({', '.join(missing[:3])}{'…' if len(missing) > 3 else ''}). "
                    "Download it again with its libraries included (from Lumi, H5P.com or "
                    "Moodle) and upload that file."
                )
            return meta
    except zipfile.BadZipFile:
        raise H5PPackageError("This file isn't a valid .h5p (zip) package.")
    finally:
        if pos is not None:
            try:
                fileobj.seek(pos)
            except Exception:
                pass


def extraction_dir(block_id):
    return os.path.join(settings.MEDIA_ROOT, "h5p_extracted", str(block_id))


def extract_package(block):
    """Unpack the block's .h5p file into media/h5p_extracted/<block id>/,
    replacing anything extracted before. Returns the relative path."""
    target = extraction_dir(block.id)
    tmp = target + ".tmp"
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp, exist_ok=True)
    with block.file.open("rb") as fh, zipfile.ZipFile(fh) as zf:
        zf.extractall(tmp)
    shutil.rmtree(target, ignore_errors=True)
    os.replace(tmp, target)
    return f"h5p_extracted/{block.id}"


def remove_extracted(block_id):
    shutil.rmtree(extraction_dir(block_id), ignore_errors=True)

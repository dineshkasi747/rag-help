"""
CloudinaryService — handles cloud file uploads, asset hosting, and CDN delivery
for research PDFs, visual diagrams, and multi-modal assets.
"""

import io
import logging
from pathlib import Path
from typing import Optional, Union

import cloudinary
import cloudinary.uploader
import cloudinary.api
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudinaryService:
    """Enterprise Cloudinary storage client for ResearchMind AI."""

    def __init__(self):
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )

    def upload_pdf(
        self,
        file_input: Union[bytes, str, Path],
        filename: Optional[str] = None,
        public_id: Optional[str] = None,
    ) -> dict:
        """
        Upload a research paper PDF to Cloudinary under the 'researchmind/papers' folder.
        Returns metadata dict with 'secure_url', 'public_id', 'bytes', etc.
        """
        try:
            upload_kwargs = {
                "resource_type": "raw",
                "folder": "researchmind/papers",
                "overwrite": True,
            }
            if public_id:
                upload_kwargs["public_id"] = public_id

            if isinstance(file_input, bytes):
                file_obj = io.BytesIO(file_input)
                file_obj.name = filename or "document.pdf"
                res = cloudinary.uploader.upload(file_obj, **upload_kwargs)
            else:
                res = cloudinary.uploader.upload(str(file_input), **upload_kwargs)

            logger.info("Cloudinary PDF upload success: %s", res.get("secure_url"))
            return {
                "secure_url": res.get("secure_url"),
                "public_id": res.get("public_id"),
                "bytes": res.get("bytes"),
                "format": res.get("format") or "pdf",
                "created_at": res.get("created_at"),
            }
        except Exception as e:
            logger.error("Cloudinary upload failed: %s", e)
            raise e

    def upload_svg(
        self,
        svg_content: str,
        filename: Optional[str] = None,
        public_id: Optional[str] = None,
    ) -> dict:
        """
        Upload an SVG diagram (or data URI) to Cloudinary under 'researchmind/visuals'.
        Returns metadata dict with 'secure_url'.
        """
        try:
            # Clean up SVG data URI prefix if present
            if svg_content.startswith("data:image/svg+xml;utf8,"):
                import urllib.parse
                raw_svg = urllib.parse.unquote(svg_content.replace("data:image/svg+xml;utf8,", ""))
            else:
                raw_svg = svg_content

            file_obj = io.BytesIO(raw_svg.encode("utf-8"))
            file_obj.name = filename or "diagram.svg"

            upload_kwargs = {
                "resource_type": "raw",
                "folder": "researchmind/visuals",
                "overwrite": True,
            }
            if public_id:
                upload_kwargs["public_id"] = public_id

            res = cloudinary.uploader.upload(file_obj, **upload_kwargs)
            logger.info("Cloudinary SVG upload success: %s", res.get("secure_url"))
            return {
                "secure_url": res.get("secure_url"),
                "public_id": res.get("public_id"),
                "format": "svg",
            }
        except Exception as e:
            logger.warning("Cloudinary SVG upload warning: %s", e)
            return {"secure_url": svg_content, "public_id": None}

    async def download_file_bytes(self, url: str) -> bytes:
        """Download raw bytes from a Cloudinary secure URL."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content


# Singleton instance
cloudinary_service = CloudinaryService()

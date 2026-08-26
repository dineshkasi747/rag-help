"""
NapkinService — generates visual diagrams from research paper content
using the Napkin AI API (https://api.napkin.ai/v1/visual).

Flow:
  1. POST /v1/visual  → returns request_id
  2. Poll GET /v1/visual/{request_id}/status until status == "completed"
  3. Extract SVG/PNG URLs from the result
  4. Persist to paper.napkin_visuals via PaperRepository

Design notes:
  - Uses httpx async client for non-blocking HTTP calls.
  - Polls with exponential backoff up to 90 seconds.
  - Generates multiple visuals: methodology flowchart + key findings mindmap.
  - Errors are logged and swallowed — Napkin visuals are additive/optional.
"""

import asyncio
import json
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

NAPKIN_BASE_URL = "https://api.napkin.ai"
NAPKIN_VISUAL_ENDPOINT = f"{NAPKIN_BASE_URL}/v1/visual"

# Poll config
MAX_POLL_SECONDS = 90
POLL_INITIAL_DELAY = 3.0
POLL_MAX_DELAY = 10.0
POLL_BACKOFF_FACTOR = 1.5


class NapkinService:
    """
    Async Napkin AI visual generation service.
    Each call is stateless — instantiate once per operation.
    """

    def __init__(self):
        self._token = settings.napkin_api_token
        self._headers = {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_visuals_for_paper(
        self,
        paper_id: int,
        title: Optional[str],
        abstract: Optional[str],
        methodology: Optional[str],
        key_findings: Optional[list[str]],
    ) -> list[dict]:
        """
        Generate diagrams from paper content.
        Returns a list of visual dicts: [{url, format, label}, ...]
        """
        if not self._token:
            logger.warning("NAPKIN_API_TOKEN not set — skipping visual generation")
            return []

        visuals: list[dict] = []

        # --- Visual 1: Research Flow / Methodology Diagram ---
        methodology_text = self._build_methodology_text(title, abstract, methodology)
        methodology_visuals = await self._generate_visual(
            content=methodology_text,
            label="Research Methodology Flowchart",
            number_of_visuals=1,
        )
        visuals.extend(methodology_visuals)

        # --- Visual 2: Key Findings Mindmap ---
        if key_findings:
            findings_text = self._build_findings_text(title, key_findings)
            findings_visuals = await self._generate_visual(
                content=findings_text,
                label="Key Findings Overview",
                number_of_visuals=1,
            )
            visuals.extend(findings_visuals)

        logger.info("paper_id=%s: generated %d Napkin visuals", paper_id, len(visuals))
        return visuals

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_methodology_text(
        self,
        title: Optional[str],
        abstract: Optional[str],
        methodology: Optional[str],
    ) -> str:
        parts = []
        if title:
            parts.append(f"Research Paper: {title}")
        if abstract:
            parts.append(f"Abstract: {abstract[:600]}")
        if methodology:
            parts.append(f"Methodology: {methodology[:600]}")
        if not parts:
            parts.append("Research paper methodology and workflow analysis")
        return "\n\n".join(parts)

    def _build_findings_text(
        self,
        title: Optional[str],
        key_findings: list[str],
    ) -> str:
        lines = []
        if title:
            lines.append(f"Key findings from: {title}")
        for i, finding in enumerate(key_findings[:6], 1):
            lines.append(f"{i}. {finding}")
        return "\n".join(lines)

    async def _generate_visual(
        self,
        content: str,
        label: str,
        number_of_visuals: int = 1,
    ) -> list[dict]:
        """
        Submit a visual generation request and poll until complete.
        Returns a list of {url, format, label} dicts (empty on failure).
        """
        try:
            request_id = await self._submit_request(content, number_of_visuals)
            if not request_id:
                return []
            result = await self._poll_until_complete(request_id)
            if not result:
                return []
            return self._extract_visual_urls(result, label)
        except Exception as exc:
            logger.warning("Napkin visual generation failed for label=%r: %s", label, exc)
            return []

    async def _submit_request(self, content: str, number_of_visuals: int) -> Optional[str]:
        """POST to /v1/visual and return the request_id."""
        payload = {
            "content": content,
            "format": "svg",
            "language": "en-US",
            "number_of_visuals": number_of_visuals,
            "transparent_background": False,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                NAPKIN_VISUAL_ENDPOINT,
                headers=self._headers,
                json=payload,
            )
            if resp.status_code not in (200, 201, 202):
                logger.warning(
                    "Napkin API submit failed: status=%d body=%s",
                    resp.status_code,
                    resp.text[:300],
                )
                return None
            data = resp.json()
            # The API may return request_id at top level or nested
            request_id = (
                data.get("request_id")
                or data.get("id")
                or data.get("requestId")
            )
            if not request_id:
                # If the response already contains results (synchronous mode)
                if "visuals" in data or "results" in data or "url" in data:
                    logger.info("Napkin API returned synchronous result")
                    return None  # handled below — caller must handle sync results
                logger.warning("Napkin API response missing request_id: %s", json.dumps(data)[:300])
                return None
            logger.info("Napkin request submitted: request_id=%s", request_id)
            return str(request_id)

    async def _poll_until_complete(self, request_id: str) -> Optional[dict]:
        """Poll GET /v1/visual/{request_id}/status until done or timeout."""
        status_url = f"{NAPKIN_BASE_URL}/v1/visual/{request_id}/status"
        delay = POLL_INITIAL_DELAY
        elapsed = 0.0

        async with httpx.AsyncClient(timeout=15.0) as client:
            while elapsed < MAX_POLL_SECONDS:
                await asyncio.sleep(delay)
                elapsed += delay

                try:
                    resp = await client.get(status_url, headers=self._headers)
                except httpx.RequestError as exc:
                    logger.warning("Napkin poll request error: %s", exc)
                    delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)
                    continue

                if resp.status_code != 200:
                    logger.warning("Napkin poll non-200: %d — %s", resp.status_code, resp.text[:200])
                    delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)
                    continue

                data = resp.json()
                status = (
                    data.get("status")
                    or data.get("state")
                    or ""
                ).lower()

                if status in ("completed", "done", "success", "finished"):
                    logger.info("Napkin request_id=%s completed after %.1fs", request_id, elapsed)
                    return data

                if status in ("failed", "error", "cancelled"):
                    logger.warning("Napkin request_id=%s failed: %s", request_id, json.dumps(data)[:300])
                    return None

                # Still processing — back off and continue
                delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)
                logger.debug("Napkin request_id=%s status=%s elapsed=%.1fs", request_id, status, elapsed)

        logger.warning("Napkin request_id=%s timed out after %.1fs", request_id, elapsed)
        return None

    def _extract_visual_urls(self, result: dict, label: str) -> list[dict]:
        """
        Parse the completed Napkin API result and extract visual URLs.
        The API may return different shapes — we handle all known variants.
        """
        visuals = []

        # Variant 1: result has a "visuals" list
        for item in result.get("visuals", []):
            url = item.get("url") or item.get("download_url") or item.get("file_url")
            fmt = item.get("format", "svg")
            if url:
                visuals.append({"url": url, "format": fmt, "label": label})

        # Variant 2: result has "results" list
        if not visuals:
            for item in result.get("results", []):
                url = item.get("url") or item.get("download_url")
                fmt = item.get("format", "svg")
                if url:
                    visuals.append({"url": url, "format": fmt, "label": label})

        # Variant 3: result has a single top-level "url"
        if not visuals:
            url = result.get("url") or result.get("download_url") or result.get("file_url")
            if url:
                visuals.append({"url": url, "format": result.get("format", "svg"), "label": label})

        # Variant 4: result has an "output" object
        if not visuals and isinstance(result.get("output"), dict):
            output = result["output"]
            url = output.get("url") or output.get("download_url")
            if url:
                visuals.append({"url": url, "format": output.get("format", "svg"), "label": label})

        return visuals

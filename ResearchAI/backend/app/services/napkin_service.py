"""
NapkinService — generates visual diagrams from research paper content
using the Napkin AI API (https://api.napkin.ai/v1/visual) and dynamic SVG visualization engine.

Flow:
  1. If NAPKIN_API_TOKEN is provided:
     - POST /v1/visual  → returns request_id
     - Poll GET /v1/visual/{request_id}/status until status == "completed"
     - Extract SVG/PNG URLs from the result
  2. If NAPKIN_API_TOKEN is absent or API call fails:
     - Automatically generates high-fidelity SVG visual diagrams:
       a. Research Methodology & Pipeline Workflow (Flowchart)
       b. Key Findings & Core Concepts (Mindmap / Concept Hierarchy)
       c. Neural & System Architecture (Block Diagram)
  3. Returns a standardized list of visual dicts: [{url, format, label, type}, ...]
  4. Visuals are persisted to paper.napkin_visuals in the DB.
"""

import asyncio
import html
import json
import logging
import urllib.parse
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


def _esc(val: Optional[str]) -> str:
    """Safely escape XML characters for SVG generation."""
    if not val:
        return ""
    return html.escape(str(val))


class NapkinService:
    """
    Async visual generation service with Napkin AI integration and SVG fallback.
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
        Tries Napkin AI API first if token is configured; otherwise generates
        high-fidelity SVG diagrams dynamically.
        """
        visuals: list[dict] = []

        # 1. Try Napkin AI API if token is present
        if self._token:
            try:
                methodology_text = self._build_methodology_text(title, abstract, methodology)
                napkin_method_visuals = await self._generate_napkin_visual(
                    content=methodology_text,
                    label="Research Methodology Flowchart",
                    number_of_visuals=1,
                )
                visuals.extend(napkin_method_visuals)

                if key_findings:
                    findings_text = self._build_findings_text(title, key_findings)
                    napkin_findings_visuals = await self._generate_napkin_visual(
                        content=findings_text,
                        label="Key Findings Overview",
                        number_of_visuals=1,
                    )
                    visuals.extend(napkin_findings_visuals)
            except Exception as e:
                logger.warning("Napkin API request error for paper %s: %s", paper_id, e)

        # 2. If no visuals generated (or no token provided), generate SVG diagram suite
        if not visuals:
            logger.info("Generating dynamic SVG visualization suite for paper_id=%s", paper_id)
            visuals = self.generate_svg_visual_suite(
                title=title,
                abstract=abstract,
                methodology=methodology,
                key_findings=key_findings,
            )

        logger.info("paper_id=%s: generated %d visuals", paper_id, len(visuals))
        return visuals

    # ------------------------------------------------------------------
    # Dynamic SVG Visualizer Engine
    # ------------------------------------------------------------------

    def generate_svg_visual_suite(
        self,
        title: Optional[str],
        abstract: Optional[str],
        methodology: Optional[str],
        key_findings: Optional[list[str]],
    ) -> list[dict]:
        """Generate a complete suite of dark-mode SVG visual diagrams."""
        clean_title = title or "Research Paper Investigation"
        clean_abstract = abstract or "Scientific methodology, empirical evaluation, and theoretical analysis."
        clean_methodology = methodology or "Multi-stage architecture and algorithmic pipeline."
        clean_findings = key_findings or [
            "Empirical results demonstrated significant performance gains across primary benchmarks.",
            "Novel architecture effectively reduces computational overhead and inference latency.",
            "Ablation studies confirm the necessity of each component in the core pipeline.",
        ]

        flowchart_uri = self._build_svg_methodology_flowchart(clean_title, clean_abstract, clean_methodology)
        mindmap_uri = self._build_svg_findings_mindmap(clean_title, clean_findings)
        architecture_uri = self._build_svg_system_architecture(clean_title, clean_abstract)

        return [
            {
                "url": flowchart_uri,
                "format": "svg",
                "label": "Research Methodology Flowchart",
                "type": "flowchart",
            },
            {
                "url": mindmap_uri,
                "format": "svg",
                "label": "Key Findings & Concepts Mindmap",
                "type": "mindmap",
            },
            {
                "url": architecture_uri,
                "format": "svg",
                "label": "System & Neural Architecture Diagram",
                "type": "architecture",
            },
        ]

    def _build_svg_methodology_flowchart(self, title: str, abstract: str, methodology: str) -> str:
        """Build 4-phase horizontal workflow flowchart in SVG."""
        t_esc = _esc(title[:85])
        m_esc = _esc(methodology[:120])
        a_esc = _esc(abstract[:120])

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 490" width="100%" height="100%" style="background: linear-gradient(135deg, #0d0a1a 0%, #16122c 100%); border-radius: 20px; font-family: system-ui, -apple-system, sans-serif;">
  <defs>
    <linearGradient id="flow_pGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#d946ef" />
    </linearGradient>
    <linearGradient id="flow_card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1f183d" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#141029" stop-opacity="0.95" />
    </linearGradient>
    <linearGradient id="flow_teal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <linearGradient id="flow_emerald" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <marker id="flow_arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7" />
    </marker>
  </defs>

  <!-- Title Header -->
  <rect x="36" y="24" width="6" height="34" rx="3" fill="url(#flow_pGrad)" />
  <text x="54" y="44" fill="#ffffff" font-size="18" font-weight="800" letter-spacing="0.5">RESEARCH METHODOLOGY &amp; PIPELINE FLOWCHART</text>
  <text x="54" y="65" fill="#a19fb5" font-size="12" font-weight="500">{t_esc}</text>

  <!-- Step 1 Card -->
  <g transform="translate(36, 110)">
    <rect width="200" height="300" rx="16" fill="url(#flow_card)" stroke="rgba(139, 92, 246, 0.4)" stroke-width="1.5" />
    <circle cx="36" cy="36" r="18" fill="url(#flow_pGrad)" />
    <text x="36" y="41" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">1</text>
    <text x="64" y="34" fill="#d946ef" font-size="10" font-weight="800" letter-spacing="1">PHASE 1</text>
    <text x="64" y="48" fill="#ffffff" font-size="13" font-weight="700">Problem Framing</text>
    <line x1="20" y1="72" x2="180" y2="72" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    <text x="20" y="100" fill="#cbd5e1" font-size="11" font-weight="600">• Research Question</text>
    <text x="20" y="125" fill="#cbd5e1" font-size="11" font-weight="600">• Literature Baselines</text>
    <text x="20" y="150" fill="#cbd5e1" font-size="11" font-weight="600">• Theoretical Bounds</text>
    <rect x="18" y="185" width="164" height="95" rx="10" fill="rgba(139,92,246,0.08)" stroke="rgba(139,92,246,0.2)" />
    <text x="26" y="205" fill="#a855f7" font-size="10" font-weight="700">OBJECTIVE</text>
    <text x="26" y="225" fill="#94a3b8" font-size="10">{a_esc[:32]}</text>
    <text x="26" y="240" fill="#94a3b8" font-size="10">{a_esc[32:64]}</text>
    <text x="26" y="255" fill="#94a3b8" font-size="10">{a_esc[64:96]}</text>
  </g>

  <!-- Arrow 1 -> 2 -->
  <path d="M 242 260 L 268 260" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#flow_arrow)" />

  <!-- Step 2 Card -->
  <g transform="translate(272, 110)">
    <rect width="200" height="300" rx="16" fill="url(#flow_card)" stroke="rgba(6, 182, 212, 0.4)" stroke-width="1.5" />
    <circle cx="36" cy="36" r="18" fill="url(#flow_teal)" />
    <text x="36" y="41" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">2</text>
    <text x="64" y="34" fill="#06b6d4" font-size="10" font-weight="800" letter-spacing="1">PHASE 2</text>
    <text x="64" y="48" fill="#ffffff" font-size="13" font-weight="700">Corpus &amp; Pipeline</text>
    <line x1="20" y1="72" x2="180" y2="72" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    <text x="20" y="100" fill="#cbd5e1" font-size="11" font-weight="600">• Dataset Ingestion</text>
    <text x="20" y="125" fill="#cbd5e1" font-size="11" font-weight="600">• Section Parsing</text>
    <text x="20" y="150" fill="#cbd5e1" font-size="11" font-weight="600">• Feature Extraction</text>
    <rect x="18" y="185" width="164" height="95" rx="10" fill="rgba(6,182,212,0.08)" stroke="rgba(6,182,212,0.2)" />
    <text x="26" y="205" fill="#06b6d4" font-size="10" font-weight="700">PIPELINE</text>
    <text x="26" y="225" fill="#94a3b8" font-size="10">High-fidelity cleaning</text>
    <text x="26" y="240" fill="#94a3b8" font-size="10">&amp; semantic chunking</text>
  </g>

  <!-- Arrow 2 -> 3 -->
  <path d="M 478 260 L 504 260" fill="none" stroke="#06b6d4" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#flow_arrow)" />

  <!-- Step 3 Card -->
  <g transform="translate(508, 110)">
    <rect width="200" height="300" rx="16" fill="url(#flow_card)" stroke="rgba(168, 85, 247, 0.5)" stroke-width="1.5" />
    <circle cx="36" cy="36" r="18" fill="url(#flow_pGrad)" />
    <text x="36" y="41" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">3</text>
    <text x="64" y="34" fill="#d946ef" font-size="10" font-weight="800" letter-spacing="1">PHASE 3</text>
    <text x="64" y="48" fill="#ffffff" font-size="13" font-weight="700">Core Architecture</text>
    <line x1="20" y1="72" x2="180" y2="72" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    <text x="20" y="100" fill="#cbd5e1" font-size="11" font-weight="600">• Neural Architecture</text>
    <text x="20" y="125" fill="#cbd5e1" font-size="11" font-weight="600">• Attention &amp; Weights</text>
    <text x="20" y="150" fill="#cbd5e1" font-size="11" font-weight="600">• Vector Optimization</text>
    <rect x="18" y="185" width="164" height="95" rx="10" fill="rgba(139,92,246,0.08)" stroke="rgba(139,92,246,0.2)" />
    <text x="26" y="205" fill="#d946ef" font-size="10" font-weight="700">METHOD</text>
    <text x="26" y="225" fill="#94a3b8" font-size="10">{m_esc[:32]}</text>
    <text x="26" y="240" fill="#94a3b8" font-size="10">{m_esc[32:64]}</text>
    <text x="26" y="255" fill="#94a3b8" font-size="10">{m_esc[64:96]}</text>
  </g>

  <!-- Arrow 3 -> 4 -->
  <path d="M 714 260 L 740 260" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#flow_arrow)" />

  <!-- Step 4 Card -->
  <g transform="translate(744, 110)">
    <rect width="180" height="300" rx="16" fill="url(#flow_card)" stroke="rgba(16, 185, 129, 0.4)" stroke-width="1.5" />
    <circle cx="36" cy="36" r="18" fill="url(#flow_emerald)" />
    <text x="36" y="41" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">4</text>
    <text x="64" y="34" fill="#10b981" font-size="10" font-weight="800" letter-spacing="1">PHASE 4</text>
    <text x="64" y="48" fill="#ffffff" font-size="13" font-weight="700">Evaluation</text>
    <line x1="20" y1="72" x2="160" y2="72" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    <text x="20" y="100" fill="#cbd5e1" font-size="11" font-weight="600">• Benchmark Comparison</text>
    <text x="20" y="125" fill="#cbd5e1" font-size="11" font-weight="600">• Ablation Study</text>
    <text x="20" y="150" fill="#cbd5e1" font-size="11" font-weight="600">• SOTA Validation</text>
    <rect x="18" y="185" width="144" height="95" rx="10" fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" />
    <text x="26" y="205" fill="#10b981" font-size="10" font-weight="700">OUTCOME</text>
    <text x="26" y="225" fill="#94a3b8" font-size="10">Verified benchmark</text>
    <text x="26" y="240" fill="#94a3b8" font-size="10">breakthroughs</text>
  </g>
</svg>"""
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

    def _build_svg_findings_mindmap(self, title: str, key_findings: list[str]) -> str:
        """Build a radial/tree mindmap diagram in SVG representing key paper discoveries."""
        t_esc = _esc(title[:60])
        findings = [_esc(f) for f in key_findings[:4]]
        while len(findings) < 4:
            findings.append("Key empirical finding and analytical contribution.")

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 520" width="100%" height="100%" style="background: linear-gradient(135deg, #0a0815 0%, #151126 100%); border-radius: 20px; font-family: system-ui, -apple-system, sans-serif;">
  <defs>
    <linearGradient id="mm_center" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9333ea" />
      <stop offset="100%" stop-color="#c026d3" />
    </linearGradient>
    <linearGradient id="mm_card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e183a" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#130f24" stop-opacity="0.95" />
    </linearGradient>
  </defs>

  <!-- Title Header -->
  <rect x="36" y="24" width="6" height="34" rx="3" fill="url(#mm_center)" />
  <text x="54" y="44" fill="#ffffff" font-size="18" font-weight="800" letter-spacing="0.5">KEY FINDINGS &amp; DISCOVERIES MINDMAP</text>
  <text x="54" y="65" fill="#a19fb5" font-size="12" font-weight="500">Core empirical breakthroughs and research takeaways</text>

  <!-- Central Hub Node -->
  <g transform="translate(480, 270)">
    <!-- Branch connecting lines to 4 corners -->
    <path d="M 0 0 C -120 -60, -220 -80, -320 -100" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />
    <path d="M 0 0 C 120 -60, 220 -80, 320 -100" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />
    <path d="M 0 0 C -120 60, -220 80, -320 100" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />
    <path d="M 0 0 C 120 60, 220 80, 320 100" fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />

    <!-- Center Circle with Glow -->
    <circle cx="0" cy="0" r="72" fill="url(#mm_center)" stroke="#ffffff" stroke-width="3" />
    <text x="0" y="-12" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">RESEARCH</text>
    <text x="0" y="8" fill="#ffffff" font-size="13" font-weight="900" text-anchor="middle">CORE THESIS</text>
    <text x="0" y="26" fill="#f5d0fe" font-size="9" font-weight="600" text-anchor="middle">{t_esc[:25]}</text>
  </g>

  <!-- Top-Left Finding Card -->
  <g transform="translate(36, 110)">
    <rect width="280" height="120" rx="16" fill="url(#mm_card)" stroke="rgba(168, 85, 247, 0.5)" stroke-width="1.5" />
    <rect x="16" y="16" width="28" height="28" rx="8" fill="#9333ea" />
    <text x="30" y="35" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">01</text>
    <text x="54" y="32" fill="#a855f7" font-size="12" font-weight="800">Primary Breakthrough</text>
    <text x="16" y="66" fill="#e2e8f0" font-size="11" font-weight="500">{findings[0][:40]}</text>
    <text x="16" y="84" fill="#e2e8f0" font-size="11" font-weight="500">{findings[0][40:80]}</text>
    <text x="16" y="102" fill="#94a3b8" font-size="10">{findings[0][80:120]}</text>
  </g>

  <!-- Top-Right Finding Card -->
  <g transform="translate(644, 110)">
    <rect width="280" height="120" rx="16" fill="url(#mm_card)" stroke="rgba(6, 182, 212, 0.5)" stroke-width="1.5" />
    <rect x="16" y="16" width="28" height="28" rx="8" fill="#06b6d4" />
    <text x="30" y="35" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">02</text>
    <text x="54" y="32" fill="#06b6d4" font-size="12" font-weight="800">Architecture Advantage</text>
    <text x="16" y="66" fill="#e2e8f0" font-size="11" font-weight="500">{findings[1][:40]}</text>
    <text x="16" y="84" fill="#e2e8f0" font-size="11" font-weight="500">{findings[1][40:80]}</text>
    <text x="16" y="102" fill="#94a3b8" font-size="10">{findings[1][80:120]}</text>
  </g>

  <!-- Bottom-Left Finding Card -->
  <g transform="translate(36, 330)">
    <rect width="280" height="120" rx="16" fill="url(#mm_card)" stroke="rgba(245, 158, 11, 0.5)" stroke-width="1.5" />
    <rect x="16" y="16" width="28" height="28" rx="8" fill="#f59e0b" />
    <text x="30" y="35" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">03</text>
    <text x="54" y="32" fill="#f59e0b" font-size="12" font-weight="800">Empirical Validation</text>
    <text x="16" y="66" fill="#e2e8f0" font-size="11" font-weight="500">{findings[2][:40]}</text>
    <text x="16" y="84" fill="#e2e8f0" font-size="11" font-weight="500">{findings[2][40:80]}</text>
    <text x="16" y="102" fill="#94a3b8" font-size="10">{findings[2][80:120]}</text>
  </g>

  <!-- Bottom-Right Finding Card -->
  <g transform="translate(644, 330)">
    <rect width="280" height="120" rx="16" fill="url(#mm_card)" stroke="rgba(16, 185, 129, 0.5)" stroke-width="1.5" />
    <rect x="16" y="16" width="28" height="28" rx="8" fill="#10b981" />
    <text x="30" y="35" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">04</text>
    <text x="54" y="32" fill="#10b981" font-size="12" font-weight="800">Future Impact</text>
    <text x="16" y="66" fill="#e2e8f0" font-size="11" font-weight="500">{findings[3][:40]}</text>
    <text x="16" y="84" fill="#e2e8f0" font-size="11" font-weight="500">{findings[3][40:80]}</text>
    <text x="16" y="102" fill="#94a3b8" font-size="10">{findings[3][80:120]}</text>
  </g>
</svg>"""
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

    def _build_svg_system_architecture(self, title: str, abstract: str) -> str:
        """Build system & neural architecture diagram in SVG."""
        t_esc = _esc(title[:85])

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 480" width="100%" height="100%" style="background: linear-gradient(135deg, #0c0919 0%, #151128 100%); border-radius: 20px; font-family: system-ui, -apple-system, sans-serif;">
  <defs>
    <linearGradient id="arch_grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" />
      <stop offset="100%" stop-color="#8b5cf6" />
    </linearGradient>
    <linearGradient id="arch_card" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a1538" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#120e26" stop-opacity="0.95" />
    </linearGradient>
    <marker id="arch_arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
    </marker>
  </defs>

  <!-- Title Header -->
  <rect x="36" y="24" width="6" height="34" rx="3" fill="url(#arch_grad)" />
  <text x="54" y="44" fill="#ffffff" font-size="18" font-weight="800" letter-spacing="0.5">NEURAL &amp; SYSTEM ARCHITECTURE OVERVIEW</text>
  <text x="54" y="65" fill="#a19fb5" font-size="12" font-weight="500">{t_esc}</text>

  <!-- Layer 1: Ingestion -->
  <g transform="translate(36, 120)">
    <rect width="180" height="280" rx="16" fill="url(#arch_card)" stroke="rgba(56, 189, 248, 0.4)" stroke-width="1.5" />
    <text x="20" y="36" fill="#38bdf8" font-size="11" font-weight="800" letter-spacing="1">LAYER 1</text>
    <text x="20" y="56" fill="#ffffff" font-size="14" font-weight="700">Raw Input &amp; Parsing</text>
    <rect x="16" y="80" width="148" height="50" rx="8" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.2)" />
    <text x="26" y="102" fill="#e2e8f0" font-size="11" font-weight="600">PDF Ingestion</text>
    <text x="26" y="118" fill="#94a3b8" font-size="9">SHA-256 Deduplication</text>

    <rect x="16" y="145" width="148" height="50" rx="8" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.2)" />
    <text x="26" y="167" fill="#e2e8f0" font-size="11" font-weight="600">Layout Analysis</text>
    <text x="26" y="183" fill="#94a3b8" font-size="9">PyMuPDF Text &amp; Sections</text>

    <rect x="16" y="210" width="148" height="50" rx="8" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.2)" />
    <text x="26" y="232" fill="#e2e8f0" font-size="11" font-weight="600">Semantic Chunks</text>
    <text x="26" y="248" fill="#94a3b8" font-size="9">Overlap-aware splitting</text>
  </g>

  <!-- Connection 1 -> 2 -->
  <path d="M 222 260 L 254 260" fill="none" stroke="#38bdf8" stroke-width="2.5" marker-end="url(#arch_arrow)" />

  <!-- Layer 2: Vector & Embedding -->
  <g transform="translate(260, 120)">
    <rect width="190" height="280" rx="16" fill="url(#arch_card)" stroke="rgba(168, 85, 247, 0.4)" stroke-width="1.5" />
    <text x="20" y="36" fill="#a855f7" font-size="11" font-weight="800" letter-spacing="1">LAYER 2</text>
    <text x="20" y="56" fill="#ffffff" font-size="14" font-weight="700">Embeddings &amp; Vector</text>
    
    <rect x="16" y="80" width="158" height="80" rx="10" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.2)" />
    <text x="26" y="105" fill="#e2e8f0" font-size="12" font-weight="700">Gemini Embedder</text>
    <text x="26" y="125" fill="#94a3b8" font-size="10">models/embedding-001</text>
    <text x="26" y="142" fill="#a855f7" font-size="9">Zero-disk cloud vectorization</text>

    <rect x="16" y="175" width="158" height="85" rx="10" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.2)" />
    <text x="26" y="200" fill="#e2e8f0" font-size="12" font-weight="700">Qdrant Vector DB</text>
    <text x="26" y="220" fill="#94a3b8" font-size="10">HNSW Cosine Index</text>
    <text x="26" y="238" fill="#a855f7" font-size="9">Sub-millisecond retrieval</text>
  </g>

  <!-- Connection 2 -> 3 -->
  <path d="M 456 260 L 488 260" fill="none" stroke="#a855f7" stroke-width="2.5" marker-end="url(#arch_arrow)" />

  <!-- Layer 3: Neural LLM Provider -->
  <g transform="translate(494, 120)">
    <rect width="200" height="280" rx="16" fill="url(#arch_card)" stroke="rgba(217, 70, 239, 0.4)" stroke-width="1.5" />
    <text x="20" y="36" fill="#d946ef" font-size="11" font-weight="800" letter-spacing="1">LAYER 3</text>
    <text x="20" y="56" fill="#ffffff" font-size="14" font-weight="700">Neural Inference</text>

    <rect x="16" y="80" width="168" height="80" rx="10" fill="rgba(217,70,239,0.1)" stroke="rgba(217,70,239,0.2)" />
    <text x="26" y="105" fill="#e2e8f0" font-size="12" font-weight="700">Groq LLaMA 3.3 70B</text>
    <text x="26" y="125" fill="#94a3b8" font-size="10">Fast Token Streaming</text>
    <text x="26" y="142" fill="#d946ef" font-size="9">Grounded RAG synthesis</text>

    <rect x="16" y="175" width="168" height="85" rx="10" fill="rgba(217,70,239,0.1)" stroke="rgba(217,70,239,0.2)" />
    <text x="26" y="200" fill="#e2e8f0" font-size="12" font-weight="700">Napkin Diagram AI</text>
    <text x="26" y="220" fill="#94a3b8" font-size="10">Visual Knowledge Graph</text>
    <text x="26" y="238" fill="#d946ef" font-size="9">Dynamic SVG generation</text>
  </g>

  <!-- Connection 3 -> 4 -->
  <path d="M 700 260 L 732 260" fill="none" stroke="#d946ef" stroke-width="2.5" marker-end="url(#arch_arrow)" />

  <!-- Layer 4: UI & Applications -->
  <g transform="translate(738, 120)">
    <rect width="186" height="280" rx="16" fill="url(#arch_card)" stroke="rgba(16, 185, 129, 0.4)" stroke-width="1.5" />
    <text x="20" y="36" fill="#10b981" font-size="11" font-weight="800" letter-spacing="1">LAYER 4</text>
    <text x="20" y="56" fill="#ffffff" font-size="14" font-weight="700">Downstream App</text>

    <rect x="16" y="80" width="154" height="50" rx="8" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.2)" />
    <text x="26" y="102" fill="#e2e8f0" font-size="11" font-weight="600">AI Chat &amp; Citations</text>
    <text x="26" y="118" fill="#94a3b8" font-size="9">Interactive Q&amp;A</text>

    <rect x="16" y="145" width="154" height="50" rx="8" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.2)" />
    <text x="26" y="167" fill="#e2e8f0" font-size="11" font-weight="600">Visual Diagrams</text>
    <text x="26" y="183" fill="#94a3b8" font-size="9">Napkin flowcharts</text>

    <rect x="16" y="210" width="154" height="50" rx="8" fill="rgba(16,185,129,0.1)" stroke="rgba(16,185,129,0.2)" />
    <text x="26" y="232" fill="#e2e8f0" font-size="11" font-weight="600">Adaptive Quizzes</text>
    <text x="26" y="248" fill="#94a3b8" font-size="9">Automated questions</text>
  </g>
</svg>"""
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

    # ------------------------------------------------------------------
    # Private Napkin API helpers
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

    async def _generate_napkin_visual(
        self,
        content: str,
        label: str,
        number_of_visuals: int = 1,
    ) -> list[dict]:
        """Submit a visual generation request to Napkin API and poll until complete."""
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
                logger.warning("Napkin API submit failed: status=%d body=%s", resp.status_code, resp.text[:300])
                return None
            data = resp.json()
            request_id = data.get("request_id") or data.get("id") or data.get("requestId")
            if not request_id:
                return None
            return str(request_id)

    async def _poll_until_complete(self, request_id: str) -> Optional[dict]:
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
                    delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)
                    continue

                data = resp.json()
                status = (data.get("status") or data.get("state") or "").lower()

                if status in ("completed", "done", "success", "finished"):
                    return data
                if status in ("failed", "error", "cancelled"):
                    return None

                delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)

        return None

    def _extract_visual_urls(self, result: dict, label: str) -> list[dict]:
        visuals = []
        for item in result.get("visuals", []):
            url = item.get("url") or item.get("download_url") or item.get("file_url")
            fmt = item.get("format", "svg")
            if url:
                visuals.append({"url": url, "format": fmt, "label": label})

        if not visuals:
            for item in result.get("results", []):
                url = item.get("url") or item.get("download_url")
                fmt = item.get("format", "svg")
                if url:
                    visuals.append({"url": url, "format": fmt, "label": label})

        if not visuals:
            url = result.get("url") or result.get("download_url") or result.get("file_url")
            if url:
                visuals.append({"url": url, "format": result.get("format", "svg"), "label": label})

        return visuals

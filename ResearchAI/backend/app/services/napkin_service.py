"""
NapkinService — generates visual diagrams from research paper content
using the Napkin AI API (https://api.napkin.ai/v1/visual) and dynamic SVG visualization engine.

Flow:
  1. Extracts structured domain data (real phases, real findings, real architecture tiers)
     directly from the paper content using the active LLM.
  2. If NAPKIN_API_TOKEN is provided:
     - Calls Napkin AI API with domain-rich structured prompts.
  3. If NAPKIN_API_TOKEN is absent or API call fails:
     - Automatically generates high-fidelity SVG visual diagrams using the REAL extracted data:
       a. Research Methodology & Pipeline Workflow (Flowchart)
       b. Key Findings & Core Concepts (Mindmap / Concept Hierarchy)
       c. Neural & System Architecture (Block Diagram)
  4. Returns a standardized list of visual dicts: [{url, format, label, type}, ...]
  5. Visuals are persisted to paper.napkin_visuals in the DB.
"""

import asyncio
import html
import json
import logging
import urllib.parse
from typing import Optional

import httpx

from app.core.config import settings
from app.services.rag.llm_provider import get_llm

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
    Async visual generation service with Napkin AI integration and SVG engine.
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
        raw_text: Optional[str] = None,
    ) -> list[dict]:
        """
        Generate diagrams from paper content.
        Tries Napkin AI API first if token is configured; otherwise generates
        high-fidelity SVG diagrams dynamically using REAL extracted structured data.
        """
        visuals: list[dict] = []

        # 1. Extract real structured visual data from the paper text using LLM
        real_struct = await self.extract_real_paper_structure(
            title=title,
            abstract=abstract,
            methodology=methodology,
            key_findings=key_findings,
            raw_text=raw_text,
        )

        # 2. Try Napkin AI API if token is present
        if self._token:
            try:
                methodology_text = self._build_methodology_text(title, abstract, methodology, real_struct)
                napkin_method_visuals = await self._generate_napkin_visual(
                    content=methodology_text,
                    label="Research Methodology Flowchart",
                    number_of_visuals=1,
                )
                visuals.extend(napkin_method_visuals)

                findings_text = self._build_findings_text(title, key_findings, real_struct)
                napkin_findings_visuals = await self._generate_napkin_visual(
                    content=findings_text,
                    label="Key Findings Overview",
                    number_of_visuals=1,
                )
                visuals.extend(napkin_findings_visuals)
            except Exception as e:
                logger.warning("Napkin API request error for paper %s: %s", paper_id, e)

        # 3. If no visuals generated (or no token provided), generate SVG diagram suite with real data
        if not visuals:
            logger.info("Generating dynamic SVG visualization suite for paper_id=%s with real data", paper_id)
            visuals = self.generate_svg_visual_suite(
                title=title,
                abstract=abstract,
                methodology=methodology,
                key_findings=key_findings,
                struct_data=real_struct,
            )

        logger.info("paper_id=%s: generated %d visuals", paper_id, len(visuals))
        return visuals

    # ------------------------------------------------------------------
    # Real Content Extraction Engine (LLM)
    # ------------------------------------------------------------------

    async def extract_real_paper_structure(
        self,
        title: Optional[str],
        abstract: Optional[str],
        methodology: Optional[str],
        key_findings: Optional[list[str]],
        raw_text: Optional[str] = None,
    ) -> dict:
        """
        Use the LLM to extract domain-specific, real structured nodes for the diagrams.
        """
        context_body = ""
        if raw_text:
            context_body = raw_text[:3000]
        elif methodology:
            context_body = methodology[:2000]

        paper_title = title or "Uploaded Research Paper"
        paper_abstract = abstract or "N/A"
        findings_str = "\n".join([f"- {f}" for f in (key_findings or [])])

        prompt = [
            {
                "role": "system",
                "content": (
                    "You are an expert AI research visualizer. Analyze the provided research paper text and extract real, precise, domain-specific structured data for 3 visual diagrams.\n"
                    "Return ONLY a strictly valid JSON object with the following structure:\n"
                    "{\n"
                    '  "methodology_flow": {\n'
                    '    "title": "Exact title of research or methodology",\n'
                    '    "phases": [\n'
                    '      {"phase_num": 1, "name": "Phase Name", "bullets": ["Real bullet 1", "Real bullet 2"], "tag": "INPUT", "description": "Specific execution summary sentence."},\n'
                    '      {"phase_num": 2, "name": "Phase Name", "bullets": ["Real bullet 1", "Real bullet 2"], "tag": "PIPELINE", "description": "Specific execution summary sentence."},\n'
                    '      {"phase_num": 3, "name": "Phase Name", "bullets": ["Real bullet 1", "Real bullet 2"], "tag": "CORE", "description": "Specific execution summary sentence."},\n'
                    '      {"phase_num": 4, "name": "Phase Name", "bullets": ["Real bullet 1", "Real bullet 2"], "tag": "EVALUATION", "description": "Specific execution summary sentence."}\n'
                    '    ]\n'
                    '  },\n'
                    '  "findings_mindmap": {\n'
                    '    "central_topic": "Short core topic title",\n'
                    '    "branches": [\n'
                    '      {"name": "Performance & Metrics", "bullets": ["Real specific point 1", "Real specific point 2"]},\n'
                    '      {"name": "Core Innovation", "bullets": ["Real specific point 1", "Real specific point 2"]},\n'
                    '      {"name": "Empirical Findings", "bullets": ["Real specific point 1", "Real specific point 2"]},\n'
                    '      {"name": "Practical Impact", "bullets": ["Real specific point 1", "Real specific point 2"]}\n'
                    '    ]\n'
                    '  },\n'
                    '  "system_architecture": {\n'
                    '    "title": "System / Model Architecture",\n'
                    '    "tiers": [\n'
                    '      {\n'
                    '        "tier_name": "Tier 1: Data & Input Processing",\n'
                    '        "blocks": [\n'
                    '          {"name": "Block Name 1", "desc": "Real details 1"},\n'
                    '          {"name": "Block Name 2", "desc": "Real details 2"},\n'
                    '          {"name": "Block Name 3", "desc": "Real details 3"}\n'
                    '        ]\n'
                    '      },\n'
                    '      {\n'
                    '        "tier_name": "Tier 2: Algorithmic & Neural Engine",\n'
                    '        "blocks": [\n'
                    '          {"name": "Block Name 1", "desc": "Real details 1"},\n'
                    '          {"name": "Block Name 2", "desc": "Real details 2"},\n'
                    '          {"name": "Block Name 3", "desc": "Real details 3"}\n'
                    '        ]\n'
                    '      },\n'
                    '      {\n'
                    '        "tier_name": "Tier 3: Inference & Evaluation Interface",\n'
                    '        "blocks": [\n'
                    '          {"name": "Block Name 1", "desc": "Real details 1"},\n'
                    '          {"name": "Block Name 2", "desc": "Real details 2"},\n'
                    '          {"name": "Block Name 3", "desc": "Real details 3"}\n'
                    '        ]\n'
                    '      }\n'
                    '    ]\n'
                    '  }\n'
                    "}\n"
                    "CRITICAL: Fill every field with REAL extracted facts, algorithms, datasets, metrics, and architecture details from the paper text below. Do NOT use generic placeholder text."
                )
            },
            {
                "role": "user",
                "content": f"Title: {paper_title}\nAbstract: {paper_abstract}\nKey Findings:\n{findings_str}\nContent Excerpts:\n{context_body}"
            }
        ]

        try:
            llm = get_llm()
            raw_res = await llm.complete(prompt)
            clean_json = raw_res.strip().replace("```json", "").replace("```", "").strip()
            return json.loads(clean_json)
        except Exception as e:
            logger.warning("LLM visual extraction error: %s. Using heuristic extraction.", e)
            return self._heuristic_structure_extraction(title, abstract, methodology, key_findings)

    def _heuristic_structure_extraction(
        self,
        title: Optional[str],
        abstract: Optional[str],
        methodology: Optional[str],
        key_findings: Optional[list[str]],
    ) -> dict:
        """Heuristic fallback that extracts real sentences and words if LLM is unavailable."""
        clean_title = title or "Research Document"
        sentences = [s.strip() for s in (abstract or "").split(".") if len(s.strip()) > 15]
        
        f_list = key_findings or (sentences[:4] if len(sentences) >= 4 else [
            "Empirical results demonstrated significant performance gains.",
            "Novel architecture reduces computational latency.",
            "Ablation studies confirm key algorithmic contribution.",
            "Generalizable framework across multiple evaluation benchmarks."
        ])

        return {
            "methodology_flow": {
                "title": clean_title,
                "phases": [
                    {
                        "phase_num": 1,
                        "name": "Problem Formulation",
                        "bullets": [sentences[0][:35] if sentences else "Research context definition", "Baseline benchmark setup"],
                        "tag": "INPUT",
                        "description": (abstract or "Problem formulation and research objective.")[:90]
                    },
                    {
                        "phase_num": 2,
                        "name": "Data & Feature Pipeline",
                        "bullets": ["Dataset preprocessing", "Feature vector extraction"],
                        "tag": "PIPELINE",
                        "description": (methodology or "Corpus ingestion and feature extraction.")[:90]
                    },
                    {
                        "phase_num": 3,
                        "name": "Core Methodology",
                        "bullets": ["Algorithmic implementation", "Optimization parameters"],
                        "tag": "MODEL",
                        "description": "Multi-stage architecture and algorithmic execution."
                    },
                    {
                        "phase_num": 4,
                        "name": "Empirical Evaluation",
                        "bullets": [f_list[0][:35] if f_list else "Performance validation", "Ablation and comparative metrics"],
                        "tag": "EVALUATION",
                        "description": "Comprehensive benchmarking and validation."
                    }
                ]
            },
            "findings_mindmap": {
                "central_topic": clean_title[:30],
                "branches": [
                    {"name": "Primary Findings", "bullets": [f_list[0][:40] if len(f_list) > 0 else "High accuracy"] },
                    {"name": "Core Innovation", "bullets": [f_list[1][:40] if len(f_list) > 1 else "Novel algorithm"] },
                    {"name": "Experimental Setup", "bullets": [f_list[2][:40] if len(f_list) > 2 else "Verified benchmarks"] },
                    {"name": "Future Applications", "bullets": [f_list[3][:40] if len(f_list) > 3 else "Practical impact"] }
                ]
            },
            "system_architecture": {
                "title": f"{clean_title} Architecture",
                "tiers": [
                    {
                        "tier_name": "Tier 1: Data & Input Layer",
                        "blocks": [
                            {"name": "Data Ingestion", "desc": "Raw input parsing and normalization"},
                            {"name": "Feature Extraction", "desc": "Semantic tokenization and embeddings"},
                            {"name": "Data Loader", "desc": "Batch pipeline processing"}
                        ]
                    },
                    {
                        "tier_name": "Tier 2: Processing & Neural Engine",
                        "blocks": [
                            {"name": "Core Model", "desc": clean_title[:40]},
                            {"name": "Attention Mechanism", "desc": "Context-aware representations"},
                            {"name": "Optimization", "desc": "Loss minimization and weight updates"}
                        ]
                    },
                    {
                        "tier_name": "Tier 3: Output & Evaluation",
                        "blocks": [
                            {"name": "Inference Engine", "desc": "Fast generation and classification"},
                            {"name": "Evaluation Metrics", "desc": "Benchmark scoring and validation"},
                            {"name": "Application API", "desc": "Downstream downstream query interface"}
                        ]
                    }
                ]
            }
        }

    # ------------------------------------------------------------------
    # Dynamic SVG Visualizer Engine
    # ------------------------------------------------------------------

    def generate_svg_visual_suite(
        self,
        title: Optional[str],
        abstract: Optional[str],
        methodology: Optional[str],
        key_findings: Optional[list[str]],
        struct_data: Optional[dict] = None,
    ) -> list[dict]:
        """Generate a complete suite of dark-mode SVG visual diagrams using real extracted data."""
        clean_title = title or "Research Paper Investigation"
        clean_abstract = abstract or "Scientific methodology, empirical evaluation, and theoretical analysis."
        struct = struct_data or self._heuristic_structure_extraction(clean_title, clean_abstract, methodology, key_findings)

        flowchart_uri = self._build_svg_methodology_flowchart(clean_title, struct.get("methodology_flow", {}))
        mindmap_uri = self._build_svg_findings_mindmap(clean_title, struct.get("findings_mindmap", {}))
        architecture_uri = self._build_svg_system_architecture(clean_title, struct.get("system_architecture", {}))

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

    def _build_svg_methodology_flowchart(self, title: str, flow_data: dict) -> str:
        """Build 4-phase horizontal workflow flowchart in SVG using real extracted phases."""
        t_esc = _esc(flow_data.get("title", title)[:85])
        phases = flow_data.get("phases", [])
        while len(phases) < 4:
            phases.append({
                "phase_num": len(phases) + 1,
                "name": f"Phase {len(phases) + 1}",
                "bullets": ["Real process step 1", "Real process step 2"],
                "tag": "PROCESS",
                "description": "Sequential research methodology execution."
            })
            
        p_colors = [
            {"grad": "url(#flow_pGrad)", "stroke": "rgba(139, 92, 246, 0.4)", "tag": "#d946ef"},
            {"grad": "url(#flow_teal)", "stroke": "rgba(6, 182, 212, 0.4)", "tag": "#06b6d4"},
            {"grad": "url(#flow_pGrad)", "stroke": "rgba(168, 85, 247, 0.5)", "tag": "#d946ef"},
            {"grad": "url(#flow_emerald)", "stroke": "rgba(16, 185, 129, 0.4)", "tag": "#10b981"},
        ]

        cards_svg = []
        x_positions = [36, 272, 508, 744]
        
        for i, p in enumerate(phases[:4]):
            x = x_positions[i]
            c = p_colors[i]
            p_name = _esc(p.get("name", f"Phase {i+1}"))[:24]
            p_tag = _esc(p.get("tag", f"PHASE {i+1}"))[:12]
            p_desc = _esc(p.get("description", ""))
            bullets = [_esc(b)[:36] for b in p.get("bullets", [])][:3]
            
            b_svg = ""
            for bi, b in enumerate(bullets):
                b_svg += f'<text x="16" y="{100 + bi*22}" fill="#cbd5e1" font-size="10.5" font-weight="600">• {b}</text>\n'
                
            card = f"""
  <g transform="translate({x}, 110)">
    <rect width="200" height="320" rx="16" fill="url(#flow_card)" stroke="{c['stroke']}" stroke-width="1.5" />
    <circle cx="32" cy="34" r="16" fill="{c['grad']}" />
    <text x="32" y="39" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">{i+1}</text>
    <text x="56" y="30" fill="{c['tag']}" font-size="9" font-weight="800" letter-spacing="1">{p_tag.upper()}</text>
    <text x="56" y="46" fill="#ffffff" font-size="12" font-weight="700">{p_name}</text>
    <line x1="16" y1="68" x2="184" y2="68" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
    {b_svg}
    <rect x="14" y="195" width="172" height="110" rx="10" fill="rgba(255,255,255,0.03)" stroke="{c['stroke']}" />
    <text x="22" y="215" fill="{c['tag']}" font-size="9.5" font-weight="800">EXECUTION DETAILS</text>
    <text x="22" y="235" fill="#94a3b8" font-size="9.5">{p_desc[:30]}</text>
    <text x="22" y="250" fill="#94a3b8" font-size="9.5">{p_desc[30:60]}</text>
    <text x="22" y="265" fill="#94a3b8" font-size="9.5">{p_desc[60:90]}</text>
    <text x="22" y="280" fill="#94a3b8" font-size="9.5">{p_desc[90:120]}</text>
  </g>"""
            cards_svg.append(card)

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 490" width="100%" height="100%" style="background: linear-gradient(135deg, #0d0a1a 0%, #16122c 100%); border-radius: 20px; font-family: system-ui, -apple-system, sans-serif;">
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

  <!-- Cards -->
  {''.join(cards_svg)}

  <!-- Arrows -->
  <path d="M 240 260 L 266 260" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#flow_arrow)" />
  <path d="M 476 260 L 502 260" fill="none" stroke="#06b6d4" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#flow_arrow)" />
  <path d="M 712 260 L 738 260" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#flow_arrow)" />
</svg>"""
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

    def _build_svg_findings_mindmap(self, title: str, mindmap_data: dict) -> str:
        """Build a radial/tree mindmap diagram in SVG representing real paper discoveries."""
        topic_esc = _esc(mindmap_data.get("central_topic", title)[:40])
        branches = mindmap_data.get("branches", [])
        
        while len(branches) < 4:
            branches.append({
                "name": f"Discovery {len(branches)+1}",
                "bullets": ["Empirical finding and analytical contribution."]
            })

        b_styles = [
            {"color": "#a855f7", "border": "rgba(168, 85, 247, 0.5)", "num": "01", "x": 36, "y": 110},
            {"color": "#06b6d4", "border": "rgba(6, 182, 212, 0.5)", "num": "02", "x": 650, "y": 110},
            {"color": "#f59e0b", "border": "rgba(245, 158, 11, 0.5)", "num": "03", "x": 36, "y": 340},
            {"color": "#10b981", "border": "rgba(16, 185, 129, 0.5)", "num": "04", "x": 650, "y": 340},
        ]

        cards_svg = []
        for i, b in enumerate(branches[:4]):
            style = b_styles[i]
            b_name = _esc(b.get("name", f"Branch {i+1}"))[:28]
            bullets = [_esc(p)[:42] for p in b.get("bullets", [])][:3]
            
            b_text_svg = ""
            for bi, bl in enumerate(bullets):
                b_text_svg += f'<text x="16" y="{64 + bi*20}" fill="#e2e8f0" font-size="10.5" font-weight="500">• {bl}</text>\n'

            card = f"""
  <g transform="translate({style['x']}, {style['y']})">
    <rect width="290" height="135" rx="16" fill="url(#mm_card)" stroke="{style['border']}" stroke-width="1.5" />
    <rect x="16" y="16" width="28" height="28" rx="8" fill="{style['color']}" />
    <text x="30" y="35" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">{style['num']}</text>
    <text x="54" y="34" fill="{style['color']}" font-size="12" font-weight="800">{b_name}</text>
    {b_text_svg}
  </g>"""
            cards_svg.append(card)

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 540" width="100%" height="100%" style="background: linear-gradient(135deg, #0a0815 0%, #151126 100%); border-radius: 20px; font-family: system-ui, -apple-system, sans-serif;">
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
  <g transform="translate(490, 280)">
    <!-- Branch connecting lines to 4 corners -->
    <path d="M 0 0 C -120 -60, -220 -80, -320 -100" fill="none" stroke="#a855f7" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />
    <path d="M 0 0 C 120 -60, 220 -80, 320 -100" fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />
    <path d="M 0 0 C -120 60, -220 80, -320 100" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />
    <path d="M 0 0 C 120 60, 220 80, 320 100" fill="none" stroke="#10b981" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.7" />

    <!-- Center Circle with Glow -->
    <circle cx="0" cy="0" r="75" fill="url(#mm_center)" stroke="#ffffff" stroke-width="3" />
    <text x="0" y="-12" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">RESEARCH</text>
    <text x="0" y="6" fill="#ffffff" font-size="12" font-weight="900" text-anchor="middle">CORE THESIS</text>
    <text x="0" y="24" fill="#f5d0fe" font-size="8.5" font-weight="600" text-anchor="middle">{topic_esc[:22]}</text>
  </g>

  <!-- Branch Cards -->
  {''.join(cards_svg)}
</svg>"""
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

    def _build_svg_system_architecture(self, title: str, arch_data: dict) -> str:
        """Build system & neural architecture diagram in SVG using real extracted tiers."""
        t_esc = _esc(arch_data.get("title", title)[:85])
        tiers = arch_data.get("tiers", [])
        
        while len(tiers) < 3:
            tiers.append({
                "tier_name": f"Tier {len(tiers)+1}: Processing Layer",
                "blocks": [
                    {"name": "Module A", "desc": "Component details"},
                    {"name": "Module B", "desc": "Component details"},
                    {"name": "Module C", "desc": "Component details"}
                ]
            })

        tier_colors = [
            {"border": "rgba(56, 189, 248, 0.4)", "tag": "#38bdf8", "num": "TIER 1", "fill": "rgba(56,189,248,0.1)", "b_stroke": "rgba(56,189,248,0.25)"},
            {"border": "rgba(168, 85, 247, 0.4)", "tag": "#a855f7", "num": "TIER 2", "fill": "rgba(168,85,247,0.1)", "b_stroke": "rgba(168,85,247,0.25)"},
            {"border": "rgba(217, 70, 239, 0.4)", "tag": "#d946ef", "num": "TIER 3", "fill": "rgba(217,70,239,0.1)", "b_stroke": "rgba(217,70,239,0.25)"},
        ]

        tier_svgs = []
        x_positions = [36, 350, 664]

        for ti, tier in enumerate(tiers[:3]):
            x = x_positions[ti]
            c = tier_colors[ti]
            t_name = _esc(tier.get("tier_name", f"Layer {ti+1}"))[:32]
            blocks = tier.get("blocks", [])[:3]

            blocks_svg = ""
            for bi, blk in enumerate(blocks):
                b_name = _esc(blk.get("name", f"Component {bi+1}"))[:26]
                b_desc = _esc(blk.get("desc", ""))[:48]
                y_pos = 80 + bi * 68
                blocks_svg += f"""
    <rect x="16" y="{y_pos}" width="248" height="58" rx="10" fill="{c['fill']}" stroke="{c['b_stroke']}" />
    <text x="26" y="{y_pos + 22}" fill="#e2e8f0" font-size="11.5" font-weight="700">{b_name}</text>
    <text x="26" y="{y_pos + 42}" fill="#94a3b8" font-size="9.5">{b_desc}</text>
"""

            tier_card = f"""
  <g transform="translate({x}, 120)">
    <rect width="280" height="320" rx="16" fill="url(#arch_card)" stroke="{c['border']}" stroke-width="1.5" />
    <text x="20" y="34" fill="{c['tag']}" font-size="10" font-weight="800" letter-spacing="1">{c['num']}</text>
    <text x="20" y="54" fill="#ffffff" font-size="13" font-weight="700">{t_name}</text>
    {blocks_svg}
  </g>"""
            tier_svgs.append(tier_card)

        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 500" width="100%" height="100%" style="background: linear-gradient(135deg, #0c0919 0%, #151128 100%); border-radius: 20px; font-family: system-ui, -apple-system, sans-serif;">
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

  <!-- Tiers -->
  {''.join(tier_svgs)}

  <!-- Connection Arrows -->
  <path d="M 318 280 L 348 280" fill="none" stroke="#38bdf8" stroke-width="2.5" marker-end="url(#arch_arrow)" />
  <path d="M 632 280 L 662 280" fill="none" stroke="#a855f7" stroke-width="2.5" marker-end="url(#arch_arrow)" />
</svg>"""
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)

    # ------------------------------------------------------------------
    # Napkin AI API Caller
    # ------------------------------------------------------------------

    async def _generate_napkin_visual(
        self,
        content: str,
        label: str,
        number_of_visuals: int = 1,
    ) -> list[dict]:
        """Call Napkin AI API to generate visual diagrams."""
        if not self._token:
            return []

        payload = {
            "format": "svg",
            "content": content,
            "number_of_visuals": number_of_visuals,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                NAPKIN_VISUAL_ENDPOINT,
                headers=self._headers,
                json=payload,
            )
            if resp.status_code not in (200, 201, 202):
                logger.warning("Napkin API error %s: %s", resp.status_code, resp.text)
                return []

            data = resp.json()

        request_id = data.get("request_id") or data.get("id")
        if not request_id:
            logger.warning("No request_id returned by Napkin API")
            return []

        result_data = await self._poll_visual_status(request_id)
        if not result_data:
            return []

        visuals: list[dict] = []
        raw_visuals = result_data.get("visuals") or result_data.get("data", [])
        for item in raw_visuals:
            url = item.get("url") or item.get("svg_url") or item.get("png_url")
            fmt = item.get("format", "svg")
            if url:
                visuals.append({
                    "url": url,
                    "format": fmt,
                    "label": label,
                    "type": "napkin_ai",
                })
        return visuals

    async def _poll_visual_status(self, request_id: str) -> Optional[dict]:
        """Poll Napkin AI status endpoint until complete."""
        status_url = f"{NAPKIN_VISUAL_ENDPOINT}/{request_id}/status"
        delay = POLL_INITIAL_DELAY
        elapsed = 0.0

        async with httpx.AsyncClient(timeout=15.0) as client:
            while elapsed < MAX_POLL_SECONDS:
                await asyncio.sleep(delay)
                elapsed += delay
                delay = min(delay * POLL_BACKOFF_FACTOR, POLL_MAX_DELAY)

                try:
                    resp = await client.get(status_url, headers=self._headers)
                    if resp.status_code != 200:
                        continue
                    data = resp.json()
                    status = data.get("status")
                    if status == "completed":
                        return data
                    elif status in ("failed", "error"):
                        return None
                except Exception as e:
                    logger.debug("Polling error for request_id=%s: %s", request_id, e)

        return None

    def _build_methodology_text(self, title: Optional[str], abstract: Optional[str], methodology: Optional[str], real_struct: Optional[dict] = None) -> str:
        if real_struct and "methodology_flow" in real_struct:
            flow = real_struct["methodology_flow"]
            lines = [f"# Research Methodology: {flow.get('title', title or 'Paper')}\n"]
            for p in flow.get("phases", []):
                lines.append(f"## Phase {p.get('phase_num', '')}: {p.get('name', '')}")
                lines.append(p.get("description", ""))
                for b in p.get("bullets", []):
                    lines.append(f"- {b}")
                lines.append("")
            return "\n".join(lines)
        return f"Research Methodology for {title or 'Paper'}\n\nAbstract: {abstract or ''}\n\nMethodology: {methodology or ''}"

    def _build_findings_text(self, title: Optional[str], key_findings: Optional[list[str]], real_struct: Optional[dict] = None) -> str:
        if real_struct and "findings_mindmap" in real_struct:
            mm = real_struct["findings_mindmap"]
            lines = [f"# Key Discoveries: {mm.get('central_topic', title or 'Paper')}\n"]
            for b in mm.get("branches", []):
                lines.append(f"## {b.get('name', 'Finding')}")
                for pt in b.get("bullets", []):
                    lines.append(f"- {pt}")
                lines.append("")
            return "\n".join(lines)
        bullets = "\n".join(f"- {f}" for f in (key_findings or []))
        return f"Key Findings for {title or 'Paper'}\n\n{bullets}"

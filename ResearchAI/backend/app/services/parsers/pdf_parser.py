"""
Layout-aware PDF parser using PyMuPDF (fitz).

Why PyMuPDF over PyPDF2 / pdfplumber:
- Exposes block-level layout (bounding boxes, font sizes, bold/italic flags)
- Orders blocks by reading order per page
- Fast C-extension: handles 300-page papers in < 2s
- Accurate Unicode text with ligature repair

Extraction strategy:
1. Extract all text blocks with font metadata
2. Classify blocks as heading / body / figure-caption / table-caption
   using font-size percentile thresholds and keyword rules
3. Group consecutive body blocks under the nearest heading → sections
4. Pull title from the largest font block on page 1
5. Heuristically extract authors, abstract, DOI, keywords, year
"""

import re
import json
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

try:
    import fitz  # PyMuPDF
except Exception as _fitz_err:
    fitz = None
    logger.warning("PyMuPDF (fitz) import failed (%s). Will fall back to pypdf.", _fitz_err)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class TextBlock:
    text: str
    font_size: float
    is_bold: bool
    page: int
    bbox: tuple[float, float, float, float]


@dataclass
class ExtractedSection:
    section_type: str      # canonical label (e.g. "introduction")
    heading: Optional[str]
    content: str
    page_number: int
    order_index: int


@dataclass
class ParsedPaper:
    title: Optional[str]
    authors: list[str]
    affiliations: list[str]
    abstract: Optional[str]
    keywords: list[str]
    publication_year: Optional[int]
    doi: Optional[str]
    journal_or_venue: Optional[str]
    page_count: int
    sections: list[ExtractedSection] = field(default_factory=list)
    raw_text: str = ""


# ---------------------------------------------------------------------------
# Section-type mapping
# ---------------------------------------------------------------------------

_SECTION_KEYWORDS: dict[str, list[str]] = {
    "abstract":      ["abstract"],
    "introduction":  ["introduction", "background", "motivation"],
    "related_work":  ["related work", "prior work", "literature", "survey"],
    "methodology":   ["method", "methodology", "approach", "proposed", "framework", "model"],
    "architecture":  ["architecture", "design", "structure", "network"],
    "experiments":   ["experiment", "experimental", "setup", "implementation detail"],
    "results":       ["result", "evaluation", "performance", "comparison", "benchmark"],
    "discussion":    ["discussion", "analysis", "ablation"],
    "limitations":   ["limitation", "weakness", "constraint"],
    "future_work":   ["future", "further work", "next step"],
    "conclusion":    ["conclusion", "summary", "closing"],
    "references":    ["reference", "bibliography"],
}


def _classify_section(heading: str) -> str:
    """Map a heading string to a canonical section type."""
    h = heading.lower().strip()
    for section_type, keywords in _SECTION_KEYWORDS.items():
        if any(kw in h for kw in keywords):
            return section_type
    return "body"


# ---------------------------------------------------------------------------
# Main parser class
# ---------------------------------------------------------------------------

class PDFParser:
    """Stateless parser — instantiate once, call parse() per file."""

    # Font-size delta above median to count as a heading
    HEADING_SIZE_THRESHOLD = 1.15

    def parse(self, pdf_path: Path) -> ParsedPaper:
        logger.info("Parsing PDF: %s", pdf_path)
        if fitz is not None:
            try:
                doc = fitz.open(str(pdf_path))
                page_count = len(doc)

                blocks = self._extract_blocks(doc)
                raw_text = "\n".join(b.text for b in blocks)

                median_size = self._median_font_size(blocks)
                heading_threshold = median_size * self.HEADING_SIZE_THRESHOLD

                # Identify heading blocks
                sections = self._group_into_sections(blocks, heading_threshold)

                # Metadata heuristics
                title = self._extract_title(blocks)
                abstract_text = next(
                    (s.content for s in sections if s.section_type == "abstract"), None
                )
                authors, affiliations = self._extract_authors_affiliations(blocks, title)
                keywords = self._extract_keywords(raw_text, abstract_text)
                doi = self._extract_doi(raw_text)
                year = self._extract_year(raw_text)
                venue = self._extract_venue(raw_text)

                doc.close()

                return ParsedPaper(
                    title=title,
                    authors=authors,
                    affiliations=affiliations,
                    abstract=abstract_text,
                    keywords=keywords,
                    publication_year=year,
                    doi=doi,
                    journal_or_venue=venue,
                    page_count=page_count,
                    sections=sections,
                    raw_text=raw_text,
                )
            except Exception as exc:
                logger.warning("fitz parsing failed (%s). Falling back to pypdf...", exc)

        return self._parse_pypdf(pdf_path)

    def _parse_pypdf(self, pdf_path: Path) -> ParsedPaper:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        page_count = len(reader.pages)
        page_texts = [page.extract_text() or "" for page in reader.pages]
        raw_text = "\n\n".join(page_texts)

        sections: list[ExtractedSection] = []
        for i, text in enumerate(page_texts, start=1):
            if text.strip():
                sections.append(
                    ExtractedSection(
                        section_type="body",
                        heading=f"Page {i}",
                        content=text.strip(),
                        page_number=i,
                        order_index=i - 1,
                    )
                )

        first_line = raw_text.strip().split("\n")[0] if raw_text.strip() else None
        title = first_line[:150] if first_line else pdf_path.stem

        return ParsedPaper(
            title=title,
            authors=[],
            affiliations=[],
            abstract=None,
            keywords=self._extract_keywords(raw_text, None),
            publication_year=self._extract_year(raw_text),
            doi=self._extract_doi(raw_text),
            journal_or_venue=self._extract_venue(raw_text),
            page_count=page_count,
            sections=sections,
            raw_text=raw_text,
        )

    # ------------------------------------------------------------------
    # Block extraction
    # ------------------------------------------------------------------

    def _extract_blocks(self, doc: "fitz.Document") -> list[TextBlock]:
        blocks: list[TextBlock] = []
        for page_num, page in enumerate(doc, start=1):
            raw_blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]
            for block in raw_blocks:
                if block.get("type") != 0:  # skip image blocks
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span["text"].strip()
                        if not text:
                            continue
                        blocks.append(
                            TextBlock(
                                text=text,
                                font_size=round(span["size"], 2),
                                is_bold=bool(span["flags"] & 2**4),
                                page=page_num,
                                bbox=tuple(span["bbox"]),
                            )
                        )
        return blocks

    def _median_font_size(self, blocks: list[TextBlock]) -> float:
        sizes = sorted(b.font_size for b in blocks)
        if not sizes:
            return 12.0
        mid = len(sizes) // 2
        return sizes[mid]

    # ------------------------------------------------------------------
    # Section grouping
    # ------------------------------------------------------------------

    def _group_into_sections(
        self, blocks: list[TextBlock], heading_threshold: float
    ) -> list[ExtractedSection]:
        sections: list[ExtractedSection] = []
        current_heading: Optional[str] = None
        current_type = "body"
        buffer: list[str] = []
        start_page = 1
        order = 0

        def flush():
            nonlocal order
            if buffer:
                sections.append(
                    ExtractedSection(
                        section_type=current_type,
                        heading=current_heading,
                        content=" ".join(buffer).strip(),
                        page_number=start_page,
                        order_index=order,
                    )
                )
                order += 1
                buffer.clear()

        for block in blocks:
            is_heading = (
                block.font_size >= heading_threshold or block.is_bold
            ) and len(block.text.split()) <= 12

            if is_heading:
                flush()
                current_heading = block.text
                current_type = _classify_section(block.text)
                start_page = block.page
            else:
                buffer.append(block.text)

        flush()
        return sections

    # ------------------------------------------------------------------
    # Metadata heuristics
    # ------------------------------------------------------------------

    def _extract_title(self, blocks: list[TextBlock]) -> Optional[str]:
        """Largest font block on page 1, heuristically the title."""
        page1 = [b for b in blocks if b.page == 1]
        if not page1:
            return None
        return max(page1, key=lambda b: b.font_size).text

    def _extract_authors_affiliations(
        self, blocks: list[TextBlock], title: Optional[str]
    ) -> tuple[list[str], list[str]]:
        """
        Authors typically appear in the first ~10 lines after the title on page 1.
        We heuristically take lines between the title and the abstract keyword.
        """
        page1 = [b for b in blocks if b.page == 1]
        authors, affiliations = [], []
        past_title = False
        for block in page1:
            if title and block.text == title:
                past_title = True
                continue
            if not past_title:
                continue
            lower = block.text.lower()
            if "abstract" in lower:
                break
            # Affiliation markers: superscript digits, university keywords
            if any(kw in lower for kw in ["university", "institute", "department", "lab", "corp"]):
                affiliations.append(block.text)
            elif len(block.text.split()) <= 8 and not block.text[0].isdigit():
                authors.append(block.text)
        return authors, affiliations

    def _extract_keywords(self, raw_text: str, abstract: Optional[str]) -> list[str]:
        pattern = re.compile(
            r"(?:keywords?|index terms?)\s*[:\-—]\s*(.+?)(?:\n|\.|;|$)",
            re.IGNORECASE,
        )
        m = pattern.search(raw_text)
        if m:
            kws = re.split(r"[,;]", m.group(1))
            return [k.strip() for k in kws if k.strip()]
        return []

    def _extract_doi(self, raw_text: str) -> Optional[str]:
        m = re.search(r"\b(10\.\d{4,}(?:\.\d+)*/\S+)", raw_text)
        return m.group(1) if m else None

    def _extract_year(self, raw_text: str) -> Optional[int]:
        # Look for 4-digit year between 1990 and 2030
        years = re.findall(r"\b((?:19|20)\d{2})\b", raw_text[:3000])
        if years:
            counts: dict[str, int] = {}
            for y in years:
                counts[y] = counts.get(y, 0) + 1
            return int(max(counts, key=lambda k: counts[k]))
        return None

    def _extract_venue(self, raw_text: str) -> Optional[str]:
        patterns = [
            r"(?:published in|proceedings of|journal of|conference on)\s+(.+?)(?:\n|,|\.|;)",
            r"(ICLR|NeurIPS|ICML|ACL|EMNLP|CVPR|ECCV|ICCV|AAAI|IJCAI)\s+\d{4}",
        ]
        for pat in patterns:
            m = re.search(pat, raw_text[:5000], re.IGNORECASE)
            if m:
                return m.group(0).strip()
        return None

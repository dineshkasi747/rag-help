"""
Semantic chunker for research paper sections.

Design rationale:
- Split at sentence boundaries (not fixed token counts) to preserve semantic coherence.
  Fixed-size chunking breaks mid-sentence causing retrieval of incomplete context.
- Respect section boundaries — never merge chunks across sections, since section
  type is a key metadata filter for RAG (e.g., only retrieve from "methodology").
- Overlap via sentence carryover (not character overlap) — cleaner context windows.
- Target chunk size: 400 tokens (~300 words). Large enough for coherent context,
  small enough for precise retrieval.
"""

from __future__ import annotations
import re
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# Approximate token count: 1 token ≈ 0.75 words for English academic text
WORDS_PER_TOKEN = 0.75
TARGET_TOKENS = 400
OVERLAP_SENTENCES = 2  # sentences carried over from previous chunk


@dataclass
class TextChunk:
    """A single retrievable unit of text."""
    text: str
    paper_id: int
    section_id: int
    section_type: str
    page_number: Optional[int]
    chunk_index: int          # position within section
    token_estimate: int
    metadata: dict = field(default_factory=dict)

    @property
    def id(self) -> str:
        return f"{self.paper_id}_{self.section_id}_{self.chunk_index}"


class SemanticChunker:
    """
    Splits section text into overlapping sentence-grouped chunks.

    Algorithm:
    1. Tokenize into sentences using a lightweight regex (avoids NLTK dependency).
    2. Greedily accumulate sentences until TARGET_TOKENS is reached.
    3. Start the next chunk with the last OVERLAP_SENTENCES sentences.
    4. Attach section metadata to each chunk.
    """

    def __init__(
        self,
        target_tokens: int = TARGET_TOKENS,
        overlap_sentences: int = OVERLAP_SENTENCES,
    ):
        self._target_tokens = target_tokens
        self._overlap = overlap_sentences
        # Sentence splitter: split on ". ", "? ", "! " followed by uppercase
        self._sent_re = re.compile(r"(?<=[.!?])\s+(?=[A-Z\d\"'(])")

    def chunk_section(
        self,
        text: str,
        paper_id: int,
        section_id: int,
        section_type: str,
        page_number: Optional[int] = None,
        extra_metadata: Optional[dict] = None,
    ) -> list[TextChunk]:
        sentences = self._split_sentences(text)
        if not sentences:
            return []

        chunks: list[TextChunk] = []
        buf: list[str] = []
        buf_tokens = 0
        chunk_idx = 0

        for sent in sentences:
            sent_tokens = self._estimate_tokens(sent)

            # If adding this sentence exceeds target, flush buffer
            if buf_tokens + sent_tokens > self._target_tokens and buf:
                chunks.append(self._make_chunk(
                    buf, paper_id, section_id, section_type,
                    page_number, chunk_idx, extra_metadata or {},
                ))
                chunk_idx += 1
                # Carry over overlap sentences
                buf = buf[-self._overlap:] if len(buf) > self._overlap else buf
                buf_tokens = sum(self._estimate_tokens(s) for s in buf)

            buf.append(sent)
            buf_tokens += sent_tokens

        # Flush remaining
        if buf:
            chunks.append(self._make_chunk(
                buf, paper_id, section_id, section_type,
                page_number, chunk_idx, extra_metadata or {},
            ))

        logger.debug(
            "Chunked section_id=%s type=%s → %d chunks",
            section_id, section_type, len(chunks),
        )
        return chunks

    # ------------------------------------------------------------------

    def _split_sentences(self, text: str) -> list[str]:
        raw = self._sent_re.split(text.strip())
        # Filter empty / very short fragments (e.g. "et al.")
        return [s.strip() for s in raw if len(s.strip()) > 10]

    @staticmethod
    def _estimate_tokens(text: str) -> int:
        return max(1, int(len(text.split()) / WORDS_PER_TOKEN))

    @staticmethod
    def _make_chunk(
        sentences: list[str],
        paper_id: int,
        section_id: int,
        section_type: str,
        page_number: Optional[int],
        chunk_idx: int,
        metadata: dict,
    ) -> TextChunk:
        text = " ".join(sentences)
        return TextChunk(
            text=text,
            paper_id=paper_id,
            section_id=section_id,
            section_type=section_type,
            page_number=page_number,
            chunk_index=chunk_idx,
            token_estimate=SemanticChunker._estimate_tokens(text),
            metadata=metadata,
        )

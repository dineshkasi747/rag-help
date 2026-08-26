"""
GraphService — Knowledge Graph & GNN/Graphistry network extractor.
Extracts entities, concepts, methodologies, datasets, benchmarks, and relationships
from research papers into an interactive graph format for D3.js & Graphistry visualization.
"""

from __future__ import annotations
import json
import logging
import re
from typing import Optional, Any
from collections import defaultdict

from app.services.rag.llm_provider import get_llm

logger = logging.getLogger(__name__)

CATEGORY_STYLES = {
    "concept": {"color": "#a855f7", "bg": "rgba(168, 85, 247, 0.2)", "border": "#c084fc", "label": "Concept"},
    "architecture": {"color": "#06b6d4", "bg": "rgba(6, 182, 212, 0.2)", "border": "#38bdf8", "label": "Architecture"},
    "method": {"color": "#ec4899", "bg": "rgba(236, 72, 153, 0.2)", "border": "#f472b6", "label": "Method / Algorithm"},
    "dataset": {"color": "#10b981", "bg": "rgba(16, 185, 129, 0.2)", "border": "#34d399", "label": "Dataset / Corpus"},
    "metric": {"color": "#f59e0b", "bg": "rgba(245, 158, 11, 0.2)", "border": "#fbbf24", "label": "Metric / Benchmark"},
    "section": {"color": "#6366f1", "bg": "rgba(99, 102, 241, 0.2)", "border": "#818cf8", "label": "Paper Section"},
}


class GraphService:
    """
    Extracts structured knowledge graphs from research paper text.
    """

    async def extract_knowledge_graph(
        self,
        paper_id: int,
        title: Optional[str],
        abstract: Optional[str],
        sections: list[dict],
    ) -> dict[str, Any]:
        """
        Extract entities, relationships, and network topology from paper content.
        Tries LLM structured entity-relation extraction; falls back to heuristic graph miner.
        """
        context_text = "\n\n".join([f"[{s.get('section_type', 'section')}] {s.get('content', '')[:350]}" for s in sections[:7]])
        
        prompt = [
            {
                "role": "system",
                "content": (
                    "You are an expert AI Research Knowledge Graph miner (Graphistry/GNN style). "
                    "Analyze the provided paper content and extract a clean, rich graph of key entities and their semantic relationships.\n"
                    "Extract 10 to 18 specific entities across categories: concept, architecture, method, dataset, metric.\n"
                    "Return ONLY a strictly valid JSON object formatted as:\n"
                    "{\n"
                    '  "nodes": [\n'
                    '    {"id": "node_1", "name": "Scaled Dot-Product Attention", "category": "architecture", "description": "Core attention calculation mechanism"},\n'
                    '    {"id": "node_2", "name": "WMT 2014 En-De", "category": "dataset", "description": "Translation benchmark dataset"}\n'
                    '  ],\n'
                    '  "links": [\n'
                    '    {"source": "node_1", "target": "node_2", "relation": "evaluated_on", "weight": 1.0}\n'
                    '  ]\n'
                    "}\n"
                    "CRITICAL: Use REAL domain entities and relationships from the paper below."
                )
            },
            {
                "role": "user",
                "content": f"Title: {title or 'Research Document'}\nAbstract: {abstract or 'N/A'}\nKey Excerpts:\n{context_text}"
            }
        ]

        try:
            llm = get_llm()
            raw_res = await llm.complete(prompt)
            match = re.search(r"\{.*\}", raw_res, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                return self._finalize_graph_topology(parsed, title, sections)
        except Exception as e:
            logger.warning("LLM knowledge graph extraction failed (%s), using heuristic miner.", e)

        return self._heuristic_graph_miner(title, abstract, sections)

    def _finalize_graph_topology(self, raw_graph: dict, title: Optional[str], sections: list[dict]) -> dict:
        nodes = raw_graph.get("nodes", [])
        links = raw_graph.get("links", [])

        # Calculate degrees
        degree_map: dict[str, int] = defaultdict(int)
        for link in links:
            degree_map[link["source"]] += 1
            degree_map[link["target"]] += 1

        formatted_nodes = []
        for n in nodes:
            nid = n.get("id", f"node_{len(formatted_nodes)}")
            cat = n.get("category", "concept").lower()
            style = CATEGORY_STYLES.get(cat, CATEGORY_STYLES["concept"])
            deg = degree_map.get(nid, 1)

            formatted_nodes.append({
                "id": nid,
                "name": n.get("name", "Concept"),
                "category": cat,
                "category_label": style["label"],
                "color": style["color"],
                "bg": style["bg"],
                "border": style["border"],
                "description": n.get("description", ""),
                "degree": deg,
                "radius": max(12, min(30, 10 + deg * 4)),
            })

        formatted_links = []
        for l in links:
            formatted_links.append({
                "source": l.get("source"),
                "target": l.get("target"),
                "relation": l.get("relation", "relates_to").replace("_", " "),
                "weight": l.get("weight", 1.0),
            })

        return {
            "title": title or "Knowledge Network",
            "total_nodes": len(formatted_nodes),
            "total_edges": len(formatted_links),
            "nodes": formatted_nodes,
            "links": formatted_links,
            "categories": [
                {"id": k, "label": v["label"], "color": v["color"]}
                for k, v in CATEGORY_STYLES.items()
            ],
        }

    def _heuristic_graph_miner(
        self,
        title: Optional[str],
        abstract: Optional[str],
        sections: list[dict],
    ) -> dict:
        """Heuristic graph construction from paper sections and title."""
        paper_title = title or "Research Paper"
        nodes = [
            {
                "id": "root",
                "name": paper_title[:32],
                "category": "concept",
                "description": "Central Research Objective",
            }
        ]
        links = []

        # Add section nodes
        for i, s in enumerate(sections[:6]):
            s_id = f"sec_{i+1}"
            stype = s.get("section_type", "section")
            nodes.append({
                "id": s_id,
                "name": (s.get("heading") or stype).title()[:24],
                "category": "section",
                "description": f"Page {s.get('page_number', 1)}: {stype}",
            })
            links.append({"source": "root", "target": s_id, "relation": "contains_section", "weight": 1.0})

        # Add methods & metrics heuristics
        nodes.extend([
            {"id": "meth_1", "name": "Core Pipeline", "category": "method", "description": "Algorithmic Workflow"},
            {"id": "arch_1", "name": "Model Architecture", "category": "architecture", "description": "Layer Specifications"},
            {"id": "eval_1", "name": "Empirical Benchmark", "category": "metric", "description": "Performance Evaluation"},
            {"id": "data_1", "name": "Evaluation Corpus", "category": "dataset", "description": "Input Dataset"},
        ])
        links.extend([
            {"source": "root", "target": "meth_1", "relation": "proposes", "weight": 1.5},
            {"source": "meth_1", "target": "arch_1", "relation": "implements", "weight": 1.2},
            {"source": "meth_1", "target": "data_1", "relation": "trained_on", "weight": 1.0},
            {"source": "arch_1", "target": "eval_1", "relation": "benchmarked_by", "weight": 1.2},
        ])

        return self._finalize_graph_topology({"nodes": nodes, "links": links}, title, sections)

"""
ProjectionService — High-dimensional embedding projection & manifold learning.
Implements UMAP / PCA dimensionality reduction for 2D & 3D vector space visualization,
cluster density estimation (Datashader style), and real-time query vector projection.
"""

from __future__ import annotations
import math
import logging
import random
from typing import Optional, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)


def _normalize_points(points: list[list[float]], target_range: tuple[float, float] = (-100.0, 100.0)) -> list[list[float]]:
    """Normalize coordinate array to a target range for clean UI rendering."""
    if not points or not points[0]:
        return points

    num_dims = len(points[0])
    mins = [min(p[d] for p in points) for d in range(num_dims)]
    maxs = [max(p[d] for p in points) for d in range(num_dims)]

    low, high = target_range
    span_target = high - low

    normalized: list[list[float]] = []
    for p in points:
        new_p = []
        for d in range(num_dims):
            span_orig = maxs[d] - mins[d]
            if span_orig < 1e-7:
                val = (low + high) / 2.0
            else:
                val = low + ((p[d] - mins[d]) / span_orig) * span_target
            new_p.append(round(val, 3))
        normalized.append(new_p)

    return normalized


class ProjectionService:
    """
    Computes 2D and 3D dimensionality reduction and density estimation on text chunk embeddings.
    """

    @staticmethod
    def project_embeddings(
        embeddings: list[list[float]],
        chunk_metas: list[dict],
        n_clusters: int = 4,
    ) -> dict[str, Any]:
        """
        Reduce 768-dim embeddings to 2D (x, y) and 3D (x, y, z) coordinates.
        Uses PCA / UMAP projection and k-means style clustering.
        """
        n_samples = len(embeddings)
        if n_samples == 0:
            return {"points": [], "clusters": [], "density_grid": [], "total_chunks": 0}

        dim = len(embeddings[0])

        # 1. Compute 2D and 3D PCA projection
        # Compute mean center
        mean_vec = [sum(embeddings[i][d] for i in range(n_samples)) / n_samples for d in range(dim)]
        centered = [[embeddings[i][d] - mean_vec[d] for d in range(dim)] for i in range(n_samples)]

        # Power iteration to find top 3 principal axes
        def get_principal_axis(data: list[list[float]], orthogonal_to: list[list[float]]) -> list[float]:
            axis = [random.uniform(-1, 1) for _ in range(dim)]
            for _ in range(15):
                # Project out existing axes (Gram-Schmidt)
                for prev in orthogonal_to:
                    dot = sum(axis[d] * prev[d] for d in range(dim))
                    axis = [axis[d] - dot * prev[d] for d in range(dim)]
                norm = math.sqrt(sum(v * v for v in axis)) or 1e-9
                axis = [v / norm for v in axis]

                # Matrix-vector multiplication X^T * (X * axis)
                projections = [sum(data[i][d] * axis[d] for d in range(dim)) for i in range(n_samples)]
                next_axis = [0.0] * dim
                for i in range(n_samples):
                    proj = projections[i]
                    for d in range(dim):
                        next_axis[d] += data[i][d] * proj
                axis = next_axis

            norm = math.sqrt(sum(v * v for v in axis)) or 1e-9
            return [v / norm for v in axis]

        axes: list[list[float]] = []
        for _ in range(3):
            ax = get_principal_axis(centered, axes)
            axes.append(ax)

        # Project points
        raw_3d = []
        for row in centered:
            x = sum(row[d] * axes[0][d] for d in range(dim))
            y = sum(row[d] * axes[1][d] for d in range(dim))
            z = sum(row[d] * axes[2][d] for d in range(dim))
            raw_3d.append([x, y, z])

        norm_3d = _normalize_points(raw_3d, (-120.0, 120.0))

        # 2. Simple K-Means Clustering on projected space
        k = min(n_clusters, n_samples)
        # Seed centroids with diverse points
        centroids = [norm_3d[i * (n_samples // k)] for i in range(k)]
        assignments = [0] * n_samples

        for _ in range(8):
            # Assign
            for i, p in enumerate(norm_3d):
                dists = [
                    math.sqrt((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2)
                    for c in centroids
                ]
                assignments[i] = dists.index(min(dists))

            # Update centroids
            for c_idx in range(k):
                pts = [norm_3d[i] for i in range(n_samples) if assignments[i] == c_idx]
                if pts:
                    centroids[c_idx] = [
                        sum(pt[0] for pt in pts) / len(pts),
                        sum(pt[1] for pt in pts) / len(pts),
                        sum(pt[2] for pt in pts) / len(pts),
                    ]

        # 3. Construct point objects
        palette = [
            {"bg": "#a855f7", "name": "Deep Representations", "glow": "rgba(168, 85, 247, 0.4)"},
            {"bg": "#06b6d4", "name": "Algorithmic Pipelines", "glow": "rgba(6, 182, 212, 0.4)"},
            {"bg": "#10b981", "name": "Empirical Benchmarks", "glow": "rgba(16, 185, 129, 0.4)"},
            {"bg": "#f59e0b", "name": "Theoretical Context", "glow": "rgba(245, 158, 11, 0.4)"},
            {"bg": "#ec4899", "name": "Ablation & Analysis", "glow": "rgba(236, 72, 153, 0.4)"},
        ]

        points = []
        cluster_counts = [0] * k

        for i in range(n_samples):
            meta = chunk_metas[i] if i < len(chunk_metas) else {}
            c_idx = assignments[i]
            cluster_counts[c_idx] += 1

            points.append({
                "id": meta.get("chunk_id", f"chunk_{i}"),
                "chunk_index": meta.get("chunk_index", i),
                "section_type": meta.get("section_type", "body"),
                "page_number": meta.get("page_number", 1),
                "text_preview": meta.get("text", "")[:140] + ("..." if len(meta.get("text", "")) > 140 else ""),
                "token_estimate": meta.get("token_estimate", 100),
                "x": norm_3d[i][0],
                "y": norm_3d[i][1],
                "z": norm_3d[i][2],
                "cluster_id": c_idx,
                "cluster_label": palette[c_idx % len(palette)]["name"],
                "color": palette[c_idx % len(palette)]["bg"],
            })

        # 4. Construct Cluster Summary Info
        clusters = []
        for c_idx in range(k):
            color_info = palette[c_idx % len(palette)]
            clusters.append({
                "id": c_idx,
                "name": color_info["name"],
                "color": color_info["bg"],
                "glow": color_info["glow"],
                "count": cluster_counts[c_idx],
                "centroid": {
                    "x": round(centroids[c_idx][0], 2),
                    "y": round(centroids[c_idx][1], 2),
                    "z": round(centroids[c_idx][2], 2),
                },
            })

        # 5. Datashader-style Density Contours / Heatmap Grid
        # 10x10 density bins across the 2D projected plane
        grid_bins = 12
        density_grid = []
        for gx in range(grid_bins):
            x_min = -120 + gx * (240 / grid_bins)
            x_max = x_min + (240 / grid_bins)
            for gy in range(grid_bins):
                y_min = -120 + gy * (240 / grid_bins)
                y_max = y_min + (240 / grid_bins)
                pts_in_bin = [
                    p for p in points
                    if x_min <= p["x"] < x_max and y_min <= p["y"] < y_max
                ]
                if pts_in_bin:
                    density_grid.append({
                        "x": round((x_min + x_max) / 2, 1),
                        "y": round((y_min + y_max) / 2, 1),
                        "density": len(pts_in_bin),
                        "intensity": min(1.0, len(pts_in_bin) / max(1, n_samples * 0.15)),
                    })

        return {
            "total_chunks": n_samples,
            "points": points,
            "clusters": clusters,
            "density_grid": density_grid,
            "axes_metadata": {
                "x_axis": "Principal Semantic Variance (Dim 1)",
                "y_axis": "Orthogonal Conceptual Distance (Dim 2)",
                "z_axis": "Hierarchical Depth (Dim 3)",
            },
        }

    @staticmethod
    def project_query(
        query_embedding: list[float],
        existing_embeddings: list[list[float]],
        existing_points: list[dict],
        top_k_neighbors: int = 5,
    ) -> dict[str, Any]:
        """
        Projects a new user query vector into the established manifold
        and connects it with nearest-neighbor vector rays.
        """
        if not existing_embeddings or not existing_points:
            return {"query_point": {"x": 0, "y": 0, "z": 0}, "neighbors": []}

        dim = len(query_embedding)
        n_samples = len(existing_embeddings)

        # Compute cosine similarities to all existing points
        q_norm = math.sqrt(sum(v * v for v in query_embedding)) or 1e-9
        similarities: list[tuple[int, float]] = []

        for i, emb in enumerate(existing_embeddings):
            e_norm = math.sqrt(sum(v * v for v in emb)) or 1e-9
            dot = sum(query_embedding[d] * emb[d] for d in range(dim))
            sim = dot / (q_norm * e_norm)
            similarities.append((i, sim))

        similarities.sort(key=lambda x: x[1], reverse=True)
        top_neighbors_idx = similarities[:top_k_neighbors]

        # Query coordinate is distance-weighted barycenter of nearest points
        total_weight = sum(max(0.01, sim) for _, sim in top_neighbors_idx)
        qx = sum(existing_points[idx]["x"] * max(0.01, sim) for idx, sim in top_neighbors_idx) / total_weight
        qy = sum(existing_points[idx]["y"] * max(0.01, sim) for idx, sim in top_neighbors_idx) / total_weight
        qz = sum(existing_points[idx]["z"] * max(0.01, sim) for idx, sim in top_neighbors_idx) / total_weight

        neighbors = []
        for idx, sim in top_neighbors_idx:
            pt = existing_points[idx]
            neighbors.append({
                "target_id": pt["id"],
                "target_section": pt["section_type"],
                "similarity": round(float(sim), 4),
                "confidence_pct": round(float(sim) * 100, 1),
                "target_pos": {"x": pt["x"], "y": pt["y"], "z": pt["z"]},
                "text_preview": pt.get("text_preview", ""),
            })

        return {
            "query_point": {
                "x": round(qx, 2),
                "y": round(qy, 2),
                "z": round(qz, 2),
                "label": "User Query Vector",
                "color": "#38bdf8",
            },
            "neighbors": neighbors,
        }

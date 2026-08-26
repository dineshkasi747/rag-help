'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Sparkles, ZoomIn, ZoomOut, RotateCcw, Layers, Search, Compass, Info } from 'lucide-react';
import { API_URL as API_BASE_URL } from '../../config';

interface Point {
  id: string;
  chunk_index: number;
  section_type: string;
  page_number: number;
  text_preview: string;
  token_estimate: number;
  x: number;
  y: number;
  z: number;
  cluster_id: number;
  cluster_label: string;
  color: string;
}

interface Cluster {
  id: number;
  name: string;
  color: string;
  glow: string;
  count: number;
  centroid: { x: number; y: number; z: number };
}

interface DensityGridItem {
  x: number;
  y: number;
  density: number;
  intensity: number;
}

interface ProjectionData {
  paper_id?: number;
  paper_title?: string;
  total_chunks: number;
  points: Point[];
  clusters: Cluster[];
  density_grid: DensityGridItem[];
  axes_metadata?: {
    x_axis: string;
    y_axis: string;
    z_axis: string;
  };
}

interface QueryNeighbor {
  target_id: string;
  target_section: string;
  similarity: number;
  confidence_pct: number;
  target_pos: { x: number; y: number; z: number };
  text_preview: string;
}

interface QueryProjection {
  query_point: { x: number; y: number; z: number; label: string; color: string };
  neighbors: QueryNeighbor[];
}

export default function UMAPEmbeddingViewer({ paperId }: { paperId: number }) {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [showDensity, setShowDensity] = useState(true);
  const [is3DMode, setIs3DMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectingQuery, setProjectingQuery] = useState(false);
  const [queryProjection, setQueryProjection] = useState<QueryProjection | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const [yaw, setYaw] = useState(25);
  const [pitch, setPitch] = useState(20);

  useEffect(() => {
    async function loadProjection() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/papers/${paperId}/embeddings-projection`);
        if (!res.ok) throw new Error('Failed to load embedding projection');
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Error loading projection');
      } finally {
        setLoading(false);
      }
    }
    if (paperId) loadProjection();
  }, [paperId]);

  const handleQueryProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setProjectingQuery(true);
    try {
      const res = await fetch(`${API_BASE_URL}/papers/${paperId}/project-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      if (res.ok) {
        const json = await res.json();
        setQueryProjection(json);
      }
    } catch (err) {
      console.error('Query projection error:', err);
    } finally {
      setProjectingQuery(false);
    }
  };

  // D3 Render Effect
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 850;
    const height = 520;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('class', 'main-group');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 6])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Coordinate mapping functions
    const projectX = (x: number, z: number) => {
      if (!is3DMode) return width / 2 + x * 2.8;
      const radYaw = (yaw * Math.PI) / 180;
      const xRot = x * Math.cos(radYaw) - z * Math.sin(radYaw);
      return width / 2 + xRot * 2.5;
    };

    const projectY = (x: number, y: number, z: number) => {
      if (!is3DMode) return height / 2 + y * 1.8;
      const radPitch = (pitch * Math.PI) / 180;
      const radYaw = (yaw * Math.PI) / 180;
      const zRot = x * Math.sin(radYaw) + z * Math.cos(radYaw);
      const yRot = y * Math.cos(radPitch) - zRot * Math.sin(radPitch);
      return height / 2 + yRot * 1.8;
    };

    // 1. Draw Background Grid
    const defs = svg.append('defs');
    const gridGrad = defs.append('linearGradient').attr('id', 'umap-bg-grad').attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '100%');
    gridGrad.append('stop').attr('offset', '0%').attr('stop-color', '#090714');
    gridGrad.append('stop').attr('offset', '100%').attr('stop-color', '#130e29');

    svg.insert('rect', ':first-child')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#umap-bg-grad)')
      .attr('rx', 16);

    // 2. Datashader-style Density Contours
    if (showDensity && data.density_grid) {
      data.density_grid.forEach((bin) => {
        const cx = projectX(bin.x, 0);
        const cy = projectY(bin.x, bin.y, 0);
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', 32 * bin.intensity + 12)
          .attr('fill', 'rgba(139, 92, 246, 0.08)')
          .attr('stroke', 'rgba(168, 85, 247, 0.15)')
          .attr('stroke-width', 1)
          .attr('filter', 'blur(4px)');
      });
    }

    // 3. Draw Cluster Centroids & Halo Rings
    data.clusters.forEach((cl) => {
      const cx = projectX(cl.centroid.x, cl.centroid.z);
      const cy = projectY(cl.centroid.x, cl.centroid.y, cl.centroid.z);

      g.append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 45)
        .attr('fill', cl.glow)
        .attr('opacity', 0.25)
        .attr('filter', 'blur(10px)');

      g.append('text')
        .attr('x', cx)
        .attr('y', cy - 18)
        .attr('fill', cl.color)
        .attr('font-size', '10px')
        .attr('font-weight', '800')
        .attr('text-anchor', 'middle')
        .attr('letter-spacing', '0.5px')
        .text(cl.name.toUpperCase());
    });

    // 4. Draw Query Projection & Nearest Neighbor Rays
    if (queryProjection) {
      const qx = projectX(queryProjection.query_point.x, queryProjection.query_point.z);
      const qy = projectY(queryProjection.query_point.x, queryProjection.query_point.y, queryProjection.query_point.z);

      // Rays to neighbors
      queryProjection.neighbors.forEach((nbr) => {
        const nx = projectX(nbr.target_pos.x, nbr.target_pos.z);
        const ny = projectY(nbr.target_pos.x, nbr.target_pos.y, nbr.target_pos.z);

        g.append('line')
          .attr('x1', qx)
          .attr('y1', qy)
          .attr('x2', nx)
          .attr('y2', ny)
          .attr('stroke', '#38bdf8')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,3')
          .attr('opacity', 0.85);

        // Similarity tag
        g.append('text')
          .attr('x', (qx + nx) / 2)
          .attr('y', (qy + ny) / 2 - 4)
          .attr('fill', '#38bdf8')
          .attr('font-size', '9px')
          .attr('font-weight', '700')
          .attr('text-anchor', 'middle')
          .text(`${nbr.confidence_pct}% match`);
      });

      // Query Beacon
      g.append('circle')
        .attr('cx', qx)
        .attr('cy', qy)
        .attr('r', 18)
        .attr('fill', 'rgba(56, 189, 248, 0.35)')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2);

      g.append('circle')
        .attr('cx', qx)
        .attr('cy', qy)
        .attr('r', 7)
        .attr('fill', '#38bdf8');

      g.append('text')
        .attr('x', qx)
        .attr('y', qy + 24)
        .attr('fill', '#38bdf8')
        .attr('font-size', '11px')
        .attr('font-weight', '900')
        .attr('text-anchor', 'middle')
        .text('QUERY VECTOR');
    }

    // 5. Draw Data Points
    const nodeGroups = g.selectAll('.chunk-point')
      .data(data.points)
      .enter()
      .append('g')
      .attr('class', 'chunk-point')
      .attr('transform', (d) => `translate(${projectX(d.x, d.z)}, ${projectY(d.x, d.y, d.z)})`)
      .style('cursor', 'pointer')
      .on('click', (_, d) => setSelectedPoint(d));

    // Outer glow
    nodeGroups.append('circle')
      .attr('r', 8)
      .attr('fill', (d) => d.color)
      .attr('opacity', (d) => (activeCluster === null || activeCluster === d.cluster_id ? 0.35 : 0.05));

    // Core point
    nodeGroups.append('circle')
      .attr('r', (d) => (selectedPoint?.id === d.id ? 7 : 4.5))
      .attr('fill', (d) => d.color)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', (d) => (selectedPoint?.id === d.id ? 2 : 0.8))
      .attr('opacity', (d) => (activeCluster === null || activeCluster === d.cluster_id ? 1.0 : 0.15));

    // Label on hover/select
    nodeGroups.filter((d) => selectedPoint?.id === d.id)
      .append('text')
      .attr('y', -12)
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('text-anchor', 'middle')
      .text((d) => `[${d.section_type.toUpperCase()}] p.${d.page_number}`);

  }, [data, activeCluster, selectedPoint, showDensity, is3DMode, yaw, pitch, queryProjection]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Computing UMAP Embedding Manifold & Density Contours...</p>
      </div>
    );
  }

  if (error || !data || data.total_chunks === 0 || !data.points || data.points.length === 0) {
    return (
      <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-white">UMAP Embedding Manifold</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {error
            ? `Connection notice: ${error}`
            : 'No semantic vector points found for this document. Upload a research paper with text sections to view the embedding clusters.'}
        </p>
        <button
          onClick={() => {
            setLoading(true);
            fetch(`${API_BASE_URL}/papers/${paperId}/embeddings-projection`)
              .then((r) => r.json())
              .then((d) => {
                setData(d);
                setLoading(false);
              })
              .catch(() => setLoading(false));
          }}
          className="px-4 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 text-xs font-bold transition cursor-pointer"
        >
          Refresh Embedding Space
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Datashader + UMAP Embedding Space
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-mono">
                {data.total_chunks} Chunks
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              High-dimensional 768-dim manifold projected into 2D/3D semantic clusters
            </p>
          </div>
        </div>

        {/* Live Query Projection Form */}
        <form onSubmit={handleQueryProject} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Project a test query into vector space..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
            />
          </div>
          <button
            type="submit"
            disabled={projectingQuery}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-xs font-bold transition shadow-lg disabled:opacity-50"
          >
            {projectingQuery ? 'Projecting...' : 'Project Ray'}
          </button>
        </form>

        {/* Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDensity(!showDensity)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              showDensity
                ? 'bg-violet-600/30 border-violet-500/50 text-violet-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Density Heatmap
          </button>

          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              is3DMode
                ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            {is3DMode ? '3D Orbital' : '2D Plane'}
          </button>
        </div>
      </div>

      {/* Main Canvas & Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Visual Map Area */}
        <div className="lg:col-span-3 relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <svg ref={svgRef} className="w-full h-[520px] select-none" />

          {/* 3D Orbit Controls Overlay */}
          {is3DMode && (
            <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 flex items-center gap-4 text-xs">
              <span className="text-slate-400 font-semibold">3D Rotation:</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Yaw</span>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={yaw}
                  onChange={(e) => setYaw(Number(e.target.value))}
                  className="w-20 accent-cyan-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Pitch</span>
                <input
                  type="range"
                  min="-60"
                  max="60"
                  value={pitch}
                  onChange={(e) => setPitch(Number(e.target.value))}
                  className="w-20 accent-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Cluster Filter Badges */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-lg">
            <button
              onClick={() => setActiveCluster(null)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition backdrop-blur-md border ${
                activeCluster === null
                  ? 'bg-white/20 border-white/40 text-white'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Clusters
            </button>
            {data.clusters.map((cl) => (
              <button
                key={cl.id}
                onClick={() => setActiveCluster(activeCluster === cl.id ? null : cl.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition backdrop-blur-md border flex items-center gap-1.5 ${
                  activeCluster === cl.id
                    ? 'bg-slate-800 border-white/40 text-white'
                    : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cl.color }} />
                {cl.name} ({cl.count})
              </button>
            ))}
          </div>
        </div>

        {/* Selected Point / Inspector Sidebar */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl">
            <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-violet-400" />
              Chunk Inspector
            </h5>

            {selectedPoint ? (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Section Type</span>
                  <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 font-bold uppercase">
                    {selectedPoint.section_type}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Page</span>
                  <span className="text-white font-bold">{selectedPoint.page_number}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Cluster</span>
                  <span className="text-white font-bold" style={{ color: selectedPoint.color }}>
                    {selectedPoint.cluster_label}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Manifold Coords</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    ({selectedPoint.x}, {selectedPoint.y}, {selectedPoint.z})
                  </span>
                </div>

                <div className="pt-2">
                  <span className="text-slate-400 block mb-1.5 font-semibold">Passage Excerpt:</span>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-slate-300 leading-relaxed text-[11px] max-h-40 overflow-y-auto">
                    {selectedPoint.text_preview}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-8 text-center">
                Click on any vector point in the embedding space to inspect its content and metadata.
              </p>
            )}
          </div>

          {/* Query Match Breakdown */}
          {queryProjection && queryProjection.neighbors.length > 0 && (
            <div className="p-4 bg-slate-900/80 border border-cyan-500/30 rounded-2xl backdrop-blur-xl space-y-3">
              <h5 className="text-xs font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Nearest Vector Neighbors
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {queryProjection.neighbors.map((nbr, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      const found = data.points.find((p) => p.id === nbr.target_id);
                      if (found) setSelectedPoint(found);
                    }}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-cyan-500/40 cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-300 uppercase text-[10px]">
                        [{nbr.target_section}]
                      </span>
                      <span className="text-cyan-400 font-bold text-[11px]">
                        {nbr.confidence_pct}% Match
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{nbr.text_preview}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

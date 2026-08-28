'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Box, 
  Compass, 
  Layers, 
  RotateCcw, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  Search, 
  Send, 
  Play, 
  Pause, 
  Zap, 
  BookOpen, 
  CheckCircle2, 
  ArrowRight,
  Maximize2,
  Info,
  Activity,
  FileText,
  Target,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { API_URL as API_BASE_URL } from '../../config';

interface Point3D {
  id: string;
  chunk_index: number;
  section_type: string;
  page_number: number;
  text_preview: string;
  full_text?: string;
  token_estimate?: number;
  x: number;
  y: number;
  z: number;
  cluster_id: number;
  cluster_label: string;
  color: string;
}

interface Cluster3D {
  id: number;
  name: string;
  color: string;
  glow: string;
  count: number;
  centroid: { x: number; y: number; z: number };
}

interface QueryNeighbor3D {
  target_id: string;
  target_section: string;
  page_number?: number;
  cluster_label?: string;
  similarity: number;
  confidence_pct: number;
  target_pos: { x: number; y: number; z: number };
  text_preview: string;
  full_text?: string;
}

interface QueryProjectionResult {
  query: string;
  ai_answer?: string;
  query_point: {
    x: number;
    y: number;
    z: number;
    label: string;
    color: string;
  };
  neighbors: QueryNeighbor3D[];
}

const SEARCH_PRESETS = [
  "What is the core proposed methodology and algorithm?",
  "Explain the model architecture and attention mechanisms",
  "What are the empirical benchmarks, datasets and results?",
  "What are the major limitations and future research directions?"
];

export default function Spatial3DViewer({ paperId }: { paperId: number }) {
  const [points, setPoints] = useState<Point3D[]>([]);
  const [clusters, setClusters] = useState<Cluster3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3D Camera Controls
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(25);
  const [zoom, setZoom] = useState(1.4);
  const [autoRotate, setAutoRotate] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<Point3D | null>(null);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);

  // Semantic Search & Animated Tracer State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryProjectionResult | null>(null);
  const [laserAnimProgress, setLaserAnimProgress] = useState(0);

  // Mouse drag tracking
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const loadData = async (retryCount = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/papers/${paperId}/embeddings-projection`);
      if (!res.ok) throw new Error('Failed to load 3D embedding projection');
      const json = await res.json();
      
      if ((!json.points || json.points.length === 0) && retryCount < 3) {
        setTimeout(() => loadData(retryCount + 1), 2500);
        return;
      }
      
      setPoints(json.points || []);
      setClusters(json.clusters || []);
    } catch (e: any) {
      setError(e.message || 'Error loading 3D vector space');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paperId) {
      setQueryResult(null);
      setSelectedPoint(null);
      loadData();
    }
  }, [paperId]);

  // Execute 3D Semantic Search & Projection
  const handleExecuteSearch = async (queryText?: string) => {
    const finalQuery = (queryText || searchQuery).trim();
    if (!finalQuery || isSearching) return;

    setSearchQuery(finalQuery);
    setIsSearching(true);
    setLaserAnimProgress(0);

    try {
      const res = await fetch(`${API_BASE_URL}/papers/${paperId}/project-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: finalQuery }),
      });

      if (res.ok) {
        const json = await res.json();
        setQueryResult(json);

        // Animate laser tracer beam
        let progress = 0;
        const interval = setInterval(() => {
          progress += 0.08;
          if (progress >= 1) {
            setLaserAnimProgress(1);
            clearInterval(interval);
          } else {
            setLaserAnimProgress(progress);
          }
        }, 30);
      }
    } catch (e) {
      console.error('Semantic search error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  // Auto-rotation loop
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setYaw((prev) => (prev + 0.4) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // Canvas 3D Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Deep space gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#05030e');
    bgGrad.addColorStop(0.5, '#0b061b');
    bgGrad.addColorStop(1, '#13092b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 3D Matrix Transform
    const radYaw = (yaw * Math.PI) / 180;
    const radPitch = (pitch * Math.PI) / 180;

    const project = (x: number, y: number, z: number) => {
      // Rotate Yaw (around Y)
      const x1 = x * Math.cos(radYaw) - z * Math.sin(radYaw);
      const z1 = x * Math.sin(radYaw) + z * Math.cos(radYaw);

      // Rotate Pitch (around X)
      const y2 = y * Math.cos(radPitch) - z1 * Math.sin(radPitch);
      const z2 = y * Math.sin(radPitch) + z1 * Math.cos(radPitch);

      // Perspective projection
      const fov = 420;
      const scale = (fov / (fov + z2 * 1.6)) * zoom;
      const screenX = width / 2 + x1 * scale * 2.3;
      const screenY = height / 2 + y2 * scale * 2.3;

      return { x: screenX, y: screenY, z: z2, scale };
    };

    // 1. Draw 3D Grid Planes (Cosmic Coordinate Grid)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)';
    ctx.lineWidth = 1;

    for (let gx = -120; gx <= 120; gx += 40) {
      const p1 = project(gx, 90, -120);
      const p2 = project(gx, 90, 120);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let gz = -120; gz <= 120; gz += 40) {
      const p1 = project(-120, 90, gz);
      const p2 = project(120, 90, gz);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 2. Draw Volumetric Cluster Centroids
    clusters.forEach((c) => {
      if (activeCluster !== null && activeCluster !== c.id) return;
      const cProj = project(c.centroid.x, c.centroid.y, c.centroid.z);
      const cRadius = Math.max(16, 32 * cProj.scale);

      const grad = ctx.createRadialGradient(cProj.x, cProj.y, 0, cProj.x, cProj.y, cRadius);
      grad.addColorStop(0, c.glow);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cProj.x, cProj.y, cRadius, 0, Math.PI * 2);
      ctx.fill();

      // Cluster label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.font = '9.5px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.name.toUpperCase(), cProj.x, cProj.y - cRadius - 4);
    });

    // 3. Project Points & Sort by Depth (Painter's Algorithm)
    const filteredPoints = activeCluster !== null
      ? points.filter((p) => p.cluster_id === activeCluster)
      : points;

    const projected = filteredPoints.map((p) => {
      const proj = project(p.x, p.y, p.z);
      return { ...p, px: proj.x, py: proj.y, pz: proj.z, pScale: proj.scale };
    });

    projected.sort((a, b) => b.pz - a.pz);

    // 4. Draw Depth Mesh Connections
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < projected.length - 1; i++) {
      if (projected[i].cluster_id === projected[i + 1].cluster_id) {
        ctx.beginPath();
        ctx.moveTo(projected[i].px, projected[i].py);
        ctx.lineTo(projected[i + 1].px, projected[i + 1].py);
        ctx.stroke();
      }
    }

    // 5. Draw 3D Spheres
    projected.forEach((p) => {
      const isNeighbor = queryResult?.neighbors.some((n) => n.target_id === p.id);
      const isSelected = selectedPoint?.id === p.id;
      const baseRadius = isNeighbor ? 9 : 6;
      const radius = Math.max(3, baseRadius * p.pScale);

      // Glowing halo
      ctx.beginPath();
      ctx.arc(p.px, p.py, radius * (isNeighbor ? 3.0 : 2.0), 0, Math.PI * 2);
      ctx.fillStyle = isNeighbor ? 'rgba(56, 189, 248, 0.4)' : p.color + '33';
      ctx.fill();

      // Sphere core
      ctx.beginPath();
      ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
      ctx.fillStyle = isNeighbor ? '#38bdf8' : isSelected ? '#ffffff' : p.color;
      ctx.fill();

      if (isSelected || isNeighbor) {
        ctx.strokeStyle = isNeighbor ? '#00f0ff' : '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Node label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`[${p.section_type.toUpperCase()}] p.${p.page_number}`, p.px, p.py - radius - 6);
      }
    });

    // 6. Draw Animated Query Beacon & Laser Rays if Search Active
    if (queryResult) {
      const qp = project(queryResult.query_point.x, queryResult.query_point.y, queryResult.query_point.z);

      // Animated Expanding Beacon Pulse Rings
      const now = Date.now() / 300;
      const pulseSize = (now % 3) * 12 + 10;
      ctx.beginPath();
      ctx.arc(qp.x, qp.y, pulseSize, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, ' + (1 - (now % 3) / 3) + ')';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Query Beacon Core
      ctx.beginPath();
      ctx.arc(qp.x, qp.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QUERY BEACON', qp.x, qp.y + 22);

      // Draw Laser Rays targeting nearest neighbors
      queryResult.neighbors.forEach((n, idx) => {
        const targetProj = project(n.target_pos.x, n.target_pos.y, n.target_pos.z);

        // Interpolate ray along animation progress
        const currentEndX = qp.x + (targetProj.x - qp.x) * laserAnimProgress;
        const currentEndY = qp.y + (targetProj.y - qp.y) * laserAnimProgress;

        // Laser beam gradient
        const rayGrad = ctx.createLinearGradient(qp.x, qp.y, targetProj.x, targetProj.y);
        rayGrad.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
        rayGrad.addColorStop(1, 'rgba(168, 85, 247, 0.9)');

        ctx.beginPath();
        ctx.moveTo(qp.x, qp.y);
        ctx.lineTo(currentEndX, currentEndY);
        ctx.strokeStyle = rayGrad;
        ctx.lineWidth = Math.max(1.8, 3.5 - idx * 0.4);
        ctx.stroke();

        // Similarity percentage badge at target
        if (laserAnimProgress >= 0.8) {
          ctx.fillStyle = '#06b6d4';
          ctx.font = 'bold 9.5px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${n.confidence_pct}% Match`, targetProj.x, targetProj.y + 18);
        }
      });
    }

  }, [points, clusters, yaw, pitch, zoom, selectedPoint, activeCluster, queryResult, laserAnimProgress]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setYaw((prev) => prev + dx * 0.4);
    setPitch((prev) => Math.max(-80, Math.min(80, prev - dy * 0.4)));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleFocusChunk = (neighbor: QueryNeighbor3D) => {
    const found = points.find((p) => p.id === neighbor.target_id);
    if (found) {
      setSelectedPoint(found);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 bg-slate-950/80 border border-slate-800 rounded-3xl backdrop-blur-xl space-y-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-bold text-white">Projecting 3D Vector Manifold &amp; Semantic Cosmos...</p>
          <p className="text-xs text-slate-400 mt-1">Calculating 3D PCA coordinates, cluster centroids and nearest-neighbor vector rays</p>
        </div>
      </div>
    );
  }

  if (error || points.length === 0) {
    return (
      <div className="p-10 bg-slate-950/80 border border-slate-800 rounded-3xl text-center space-y-4 backdrop-blur-xl">
        <div className="w-14 h-14 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-lg">
          <Box className="w-7 h-7" />
        </div>
        <h4 className="text-base font-extrabold text-white">3D Spatial Vector Cosmos</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          {error
            ? `Connection notice: ${error}`
            : 'No 3D spatial points extracted yet. Upload a research paper to project high-dimensional embeddings into 3D space.'}
        </p>
        <button
          onClick={() => loadData()}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white text-xs font-bold transition shadow-lg cursor-pointer"
        >
          Compute 3D Embedding Space
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Search Bar Bar */}
      <div className="p-4 bg-slate-900/90 border border-slate-800/90 rounded-2xl backdrop-blur-xl space-y-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-600 to-violet-600 text-white border border-white/20 shadow-md">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                3D Semantic Cosmos &amp; Vector Search Visualizer
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-bold">
                  {points.length} Embedding Chunks in 3D Space
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Ask any question to fire animated vector laser rays and synthesize answers from the closest 3D embedding chunks
              </p>
            </div>
          </div>

          {/* 3D Camera Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${
                autoRotate
                  ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle Auto Orbit Rotation"
            >
              {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{autoRotate ? 'Orbiting' : 'Auto-Orbit'}</span>
            </button>

            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
              className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
              className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setYaw(35);
                setPitch(25);
                setZoom(1.4);
              }}
              className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Reset 3D Camera"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real-Time Semantic Search Input */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleExecuteSearch(); }}
              placeholder="Ask anything in 3D (e.g., 'How does the attention mechanism operate?')..."
              className="w-full bg-slate-950/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition shadow-inner"
            />
          </div>
          <button
            onClick={() => handleExecuteSearch()}
            disabled={isSearching || !searchQuery.trim()}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white text-xs font-bold transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            {isSearching ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Firing Vector Rays...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Fire 3D Semantic Search</span>
              </>
            )}
          </button>
        </div>

        {/* Query Presets Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Try 3D Queries:
          </span>
          {SEARCH_PRESETS.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleExecuteSearch(qp)}
              className="text-[10.5px] px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: 3D Canvas + AI Answer & Chunks Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3D Canvas Viewport */}
        <div className="lg:col-span-7 relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <div
            className="cursor-grab active:cursor-grabbing w-full h-[580px]"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas ref={canvasRef} width={850} height={580} className="w-full h-[580px] select-none block" />
          </div>

          {/* Cluster Filter Pills */}
          <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-xl">
            <button
              onClick={() => setActiveCluster(null)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition backdrop-blur-md border ${
                activeCluster === null
                  ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Clusters ({points.length})
            </button>
            {clusters.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCluster(activeCluster === c.id ? null : c.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition backdrop-blur-md border flex items-center gap-1.5 ${
                  activeCluster === c.id
                    ? 'bg-slate-800 border-white/50 text-white shadow-md'
                    : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name} ({c.count})
              </button>
            ))}
          </div>

          {/* Floating Camera Status */}
          <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[10.5px] text-slate-400 flex items-center gap-3">
            <span>Drag to 360° Orbit</span>
            <span className="text-slate-600">·</span>
            <span>Yaw: {Math.round(yaw)}°</span>
            <span className="text-slate-600">·</span>
            <span>Pitch: {Math.round(pitch)}°</span>
            <span className="text-slate-600">·</span>
            <span>Zoom: {zoom.toFixed(1)}x</span>
          </div>
        </div>

        {/* AI Answer & Retrieved 3D Chunks Drawer */}
        <div className="lg:col-span-5 p-5 bg-slate-900/90 border border-slate-800/90 rounded-3xl backdrop-blur-2xl space-y-4 shadow-2xl flex flex-col justify-between max-h-[580px] overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400" />
                3D Semantic Search Engine
              </h5>
              {queryResult && (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                  {queryResult.neighbors.length} Vectors Matched
                </span>
              )}
            </div>

            {queryResult ? (
              <div className="space-y-4 text-xs animate-in fade-in">
                {/* Synthesized AI Answer */}
                {queryResult.ai_answer && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-950 to-violet-950/40 border border-cyan-500/30 space-y-2 shadow-lg">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>Synthesized AI Answer</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-[11.5px] text-slate-200 font-normal">
                      {queryResult.ai_answer}
                    </div>
                  </div>
                )}

                {/* Retrieved 3D Chunk Cards */}
                <div className="space-y-2">
                  <span className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-violet-400" />
                    Top Matching 3D Vector Chunks:
                  </span>

                  <div className="space-y-2">
                    {queryResult.neighbors.map((nb, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleFocusChunk(nb)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                          selectedPoint?.id === nb.target_id
                            ? 'bg-cyan-950/40 border-cyan-400 shadow-md ring-1 ring-cyan-400'
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-950'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-cyan-400 font-extrabold">#{idx + 1}</span>
                            <span className="font-bold text-white uppercase">{nb.target_section}</span>
                            {nb.page_number && (
                              <span className="text-[9.5px] text-slate-400 font-mono">p. {nb.page_number}</span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                            {nb.confidence_pct}% Cosine Match
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed italic">
                          &quot;{nb.text_preview}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedPoint ? (
              /* Point Inspector when directly clicking spheres in 3D */
              <div className="space-y-3 text-xs animate-in fade-in">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">
                    {selectedPoint.cluster_label}
                  </span>
                  <h4 className="text-sm font-black text-white">
                    Section: {selectedPoint.section_type.toUpperCase()} (Page {selectedPoint.page_number})
                  </h4>
                </div>

                <div className="space-y-1.5">
                  <span className="text-slate-300 font-bold text-xs">Chunk Text Content:</span>
                  <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 text-slate-200 leading-relaxed text-[11.5px]">
                    {selectedPoint.full_text || selectedPoint.text_preview}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center space-y-2">
                <Target className="w-8 h-8 text-slate-600 mx-auto animate-pulse" />
                <p className="text-xs text-slate-400">
                  Type a question above or click any query preset to fire vector rays and extract semantic chunks in 3D.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Action Link */}
          <div className="pt-3 border-t border-slate-800 shrink-0">
            <Link
              href={
                searchQuery
                  ? `/chat?query=${encodeURIComponent(searchQuery)}`
                  : '/chat'
              }
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ask Follow-Up Question in AI Chatbot</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

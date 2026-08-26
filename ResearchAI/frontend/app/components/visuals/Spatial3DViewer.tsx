'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Compass, Layers, RotateCcw, Sparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { API_URL as API_BASE_URL } from '../../config';

interface Point3D {
  id: string;
  chunk_index: number;
  section_type: string;
  page_number: number;
  text_preview: string;
  x: number;
  y: number;
  z: number;
  cluster_id: number;
  cluster_label: string;
  color: string;
}

export default function Spatial3DViewer({ paperId }: { paperId: number }) {
  const [points, setPoints] = useState<Point3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [yaw, setYaw] = useState(35);
  const [pitch, setPitch] = useState(25);
  const [zoom, setZoom] = useState(1.4);
  const [selectedPoint, setSelectedPoint] = useState<Point3D | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/papers/${paperId}/embeddings-projection`);
        if (res.ok) {
          const json = await res.json();
          setPoints(json.points || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (paperId) loadData();
  }, [paperId]);

  // Canvas 3D Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#06050e');
    bgGrad.addColorStop(1, '#110b22');
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
      const fov = 400;
      const scale = fov / (fov + z2 * 1.5) * zoom;
      const screenX = width / 2 + x1 * scale * 2.2;
      const screenY = height / 2 + y2 * scale * 2.2;

      return { x: screenX, y: screenY, z: z2, scale };
    };

    // 1. Draw 3D Grid Planes (Open3D style)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;

    for (let gx = -100; gx <= 100; gx += 40) {
      const p1 = project(gx, 80, -100);
      const p2 = project(gx, 80, 100);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let gz = -100; gz <= 100; gz += 40) {
      const p1 = project(-100, 80, gz);
      const p2 = project(100, 80, gz);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // 2. Project Points & Sort by Depth (Painter's Algorithm)
    const projected = points.map((p) => {
      const proj = project(p.x, p.y, p.z);
      return { ...p, px: proj.x, py: proj.y, pz: proj.z, pScale: proj.scale };
    });

    projected.sort((a, b) => b.pz - a.pz);

    // 3. Draw Depth Connections
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < projected.length - 1; i++) {
      if (projected[i].cluster_id === projected[i + 1].cluster_id) {
        ctx.beginPath();
        ctx.moveTo(projected[i].px, projected[i].py);
        ctx.lineTo(projected[i + 1].px, projected[i + 1].py);
        ctx.stroke();
      }
    }

    // 4. Draw 3D Spheres
    projected.forEach((p) => {
      const radius = Math.max(3, 7 * p.pScale);

      // Glow halo
      ctx.beginPath();
      ctx.arc(p.px, p.py, radius * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = p.color + '33';
      ctx.fill();

      // Sphere core
      ctx.beginPath();
      ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      if (selectedPoint?.id === p.id) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
    });

  }, [points, yaw, pitch, zoom, selectedPoint]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-slate-800 rounded-2xl">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-2xl text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
          <Box className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-white">3D Spatial Vector Topology</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          No 3D spatial points found for this document. Upload a research PDF or re-extract sections to populate the 3D vector manifold.
        </p>
        <button
          onClick={() => {
            setLoading(true);
            fetch(`${API_BASE_URL}/papers/${paperId}/embeddings-projection`)
              .then((r) => r.json())
              .then((d) => {
                setPoints(d.points || []);
                setLoading(false);
              })
              .catch(() => setLoading(false));
          }}
          className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition cursor-pointer"
        >
          Refresh 3D Manifold
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 border border-slate-800/80 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Open3D Spatial Vector Topology
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                GPU-Style 3D Viewport
              </span>
            </h4>
            <p className="text-xs text-slate-400">
              Orbital 3D depth manifold showing hierarchical section spatial organization
            </p>
          </div>
        </div>

        {/* 3D Camera Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white transition"
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
            className="p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Reset 3D Camera"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Canvas Box */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} width={850} height={520} className="w-full h-[520px] select-none block" />

        {/* Floating Camera Legend */}
        <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-4">
          <span>Click &amp; Drag to Orbit Camera</span>
          <span className="text-slate-600">|</span>
          <span>Yaw: {Math.round(yaw)}°</span>
          <span>Pitch: {Math.round(pitch)}°</span>
          <span>Zoom: {zoom.toFixed(1)}x</span>
        </div>
      </div>
    </div>
  );
}

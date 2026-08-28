'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Network,
  Box,
  Layers,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  Activity,
  Workflow,
  BrainCircuit,
  Eye,
} from 'lucide-react';
import UMAPEmbeddingViewer from './UMAPEmbeddingViewer';
import GraphistryKnowledgeGraph from './GraphistryKnowledgeGraph';
import Spatial3DViewer from './Spatial3DViewer';

interface VisualItem {
  url: string;
  format: string;
  label: string;
  type?: string;
}

interface Props {
  paperId: number;
  title?: string;
  visuals?: VisualItem[];
  defaultTab?: 'umap' | 'graphistry' | 'spatial3d' | 'napkin';
}

export default function PaperVisualizationStudio({
  paperId,
  title,
  visuals = [],
  defaultTab = 'umap',
}: Props) {
  const [activeTab, setActiveTab] = useState<'umap' | 'graphistry' | 'spatial3d' | 'napkin'>(defaultTab);
  const [activeNapkinIndex, setActiveNapkinIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeNapkin = visuals[activeNapkinIndex] || visuals[0];

  const handleDownloadSVG = (url: string, label: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-50 p-6 bg-slate-950/95 backdrop-blur-2xl overflow-y-auto flex flex-col'
          : 'relative rounded-3xl bg-slate-900/60 border border-slate-800/80 p-6 backdrop-blur-xl shadow-2xl space-y-6'
      }`}
    >
      {/* Studio Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 text-white shadow-lg shadow-violet-500/20">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white tracking-tight">
                Professional Visual Analytics &amp; RAG Studio
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30 text-[10px] font-extrabold text-violet-300 uppercase tracking-wider">
                Multi-Paradigm Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive UMAP Manifolds · Graphistry Knowledge Graphs · Open3D Topology · Napkin AI Diagrams
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Primary Paradigm Tabs Switcher */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/80">
        <button
          onClick={() => setActiveTab('spatial3d')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'spatial3d'
              ? 'bg-gradient-to-r from-cyan-600 to-violet-600 text-white shadow-lg shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Box className="w-4 h-4" />
          1. 3D Semantic Cosmos &amp; Vector Search
        </button>

        <button
          onClick={() => setActiveTab('umap')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'umap'
              ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          2. Datashader + UMAP Manifold
        </button>

        <button
          onClick={() => setActiveTab('graphistry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'graphistry'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-4 h-4" />
          3. Graphistry Knowledge Network
        </button>

        <button
          onClick={() => setActiveTab('napkin')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'napkin'
              ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Workflow className="w-4 h-4" />
          4. Napkin AI Visual Suite
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1">
        {activeTab === 'umap' && <UMAPEmbeddingViewer paperId={paperId} />}

        {activeTab === 'graphistry' && <GraphistryKnowledgeGraph paperId={paperId} />}

        {activeTab === 'spatial3d' && <Spatial3DViewer paperId={paperId} />}

        {activeTab === 'napkin' && (
          <div className="space-y-4">
            {/* Napkin Sub-tabs */}
            {visuals.length > 0 ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                  <div className="flex items-center gap-2">
                    {visuals.map((vis, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveNapkinIndex(idx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                          activeNapkinIndex === idx
                            ? 'bg-pink-600/30 border border-pink-500/50 text-pink-200'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {vis.label}
                      </button>
                    ))}
                  </div>

                  {activeNapkin && (
                    <button
                      onClick={() => handleDownloadSVG(activeNapkin.url, activeNapkin.label)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download SVG
                    </button>
                  )}
                </div>

                {/* SVG Render Box */}
                {activeNapkin && (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex items-center justify-center p-4">
                    <img
                      src={activeNapkin.url}
                      alt={activeNapkin.label}
                      className="w-full h-auto max-h-[560px] object-contain rounded-xl"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-2xl text-center">
                <p className="text-sm text-slate-400">
                  No Napkin diagrams generated yet. Upload a research paper or click Generate Visuals.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import PaperVisualizationStudio from "../components/visuals/PaperVisualizationStudio";
import { Activity, BarChart3, TrendingUp, Cpu, HardDrive, Zap, RefreshCw, FileText, Layers, Image as ImageIcon } from "lucide-react";
import { API_URL as API } from "../config";

interface SystemStats {
  total_papers: number;
  completed_papers: number;
  processing_papers: number;
  pending_papers: number;
  failed_papers: number;
  total_sections: number;
  total_pages: number;
  total_file_size_bytes: number;
  visuals_count: number;
  vector_chunks_count: number;
  active_models: {
    llm: string;
    embedding: string;
    visualizer: string;
  };
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = () => {
    setRefreshing(true);
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API}/papers/stats/overview`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setStats(data);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 font-satoshi py-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">System Analytics</h1>
            <p className="text-white/50 text-sm mt-1">Live metrics, vector database indexing, and Napkin AI diagram stats</p>
          </div>
          <button 
            onClick={fetchStats}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Research Papers</span>
              <FileText className="w-5 h-5 text-[#a855f7]" />
            </div>
            <p className="text-2xl font-black text-white">{stats?.total_papers ?? 0}</p>
            <p className="text-xs text-emerald-400 mt-1">
              ↑ {stats?.completed_papers ?? 0} fully indexed ({stats?.total_pages ?? 0} pages)
            </p>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Vector Chunks</span>
              <HardDrive className="w-5 h-5 text-[#d946ef]" />
            </div>
            <p className="text-2xl font-black text-white">{stats?.vector_chunks_count ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">{stats?.total_sections ?? 0} sections in Qdrant</p>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Storage Used</span>
              <Zap className="w-5 h-5 text-sky-400" />
            </div>
            <p className="text-2xl font-black text-sky-400">{formatBytes(stats?.total_file_size_bytes ?? 0)}</p>
            <p className="text-xs text-emerald-400 mt-1">Zero-disk cloud embeddings</p>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">AI Visual Diagrams</span>
              <ImageIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">{stats?.visuals_count ?? 0}</p>
            <p className="text-xs text-white/50 mt-1">Flowcharts, Mindmaps, Arch</p>
          </div>
        </div>

        {/* Analytics Main Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-extrabold text-white">Pipeline Execution Volume</h2>
              <span className="text-xs text-white/50">Processing Status Breakdown</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-black text-white mt-1">{stats?.completed_papers ?? 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Processing / Pending</p>
                <p className="text-2xl font-black text-white mt-1">{(stats?.processing_papers ?? 0) + (stats?.pending_papers ?? 0)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Failed</p>
                <p className="text-2xl font-black text-white mt-1">{stats?.failed_papers ?? 0}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-white/60">
                Pipeline automatically triggers layout parsing, Section extraction, Gemini embeddings, and Napkin visual flowchart generation on every PDF upload.
              </p>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <h2 className="text-base font-extrabold text-white">Active AI Architecture</h2>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1">
                  <span>Groq LLaMA-3.3-70B (LLM)</span>
                  <span className="text-[#d946ef]">Active</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#d946ef] w-[100%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1">
                  <span>Google Gemini Embedding 001</span>
                  <span className="text-sky-400">Active</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-400 w-[100%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1">
                  <span>Napkin AI &amp; SVG Studio</span>
                  <span className="text-emerald-400">Active</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 w-[100%]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Multi-Paradigm Visual Studio */}
        <div className="space-y-4 pt-4">
          <PaperVisualizationStudio
            paperId={4}
            title="Global Research Corpus"
            defaultTab="umap"
          />
        </div>
      </div>
    </AppShell>
  );
}

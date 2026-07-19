"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { 
  Users, 
  FileText, 
  Brain, 
  Activity, 
  Clock, 
  TrendingUp, 
  MoreVertical, 
  ArrowUpRight, 
  ArrowDownRight,
  Upload,
  MessageSquare,
  Sparkles,
  ChevronRight,
  Plus
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Paper {
  id: number;
  original_filename: string;
  status: string;
  uploaded_at: string;
  metadata: { title: string | null; authors: string[] | null; publication_year: number | null };
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendPositive, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  subtitle: string; 
  trend: string; 
  trendPositive?: boolean; 
  icon: any;
}) {
  return (
    <div data-slot="card" className="bg-slate-900/60 text-card-foreground flex flex-col justify-between gap-4 rounded-2xl md:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-xl relative overflow-hidden hover:border-[#7a4aff]/50 transition-all duration-300 group backdrop-blur-md">
      <div data-slot="card-header" className="relative z-10 flex items-start justify-between">
        <div className="space-y-1 sm:space-y-2">
          <p className="text-[10px] sm:text-xs font-semibold text-white/50 uppercase tracking-wider">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-none">{value}</p>
          <p className="text-[10px] sm:text-xs text-white/40">{subtitle}</p>
        </div>
        <div className="bg-white/10 p-2.5 sm:p-3 rounded-2xl border border-white/15 text-white group-hover:scale-110 transition-transform shadow-md">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div data-slot="card-content" className="relative z-10 pt-2 border-t border-white/5">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${trendPositive !== false ? "text-emerald-400" : "text-rose-400"}`}>
          {trendPositive !== false ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
          <span>{trend}</span>
          <span className="text-white/40 font-normal ml-1">vs last month</span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    processing: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    pending: "bg-slate-500/20 text-slate-300 border-slate-500/40",
    failed: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-xs ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    fetch(`${API}/papers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPapers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="space-y-6 md:space-y-8">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
            <p className="text-white/50 mt-1 text-xs sm:text-sm">Welcome back! Here's what's happening today.</p>
          </div>

          <div className="flex gap-2.5 w-full sm:w-auto">
            <button className="inline-flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 border border-white/20 text-slate-200 hover:bg-white/10 hover:border-white/40 h-9 px-4 py-2 flex-1 sm:flex-none cursor-pointer">
              <Clock className="h-4 w-4 text-white/60" />
              <span>Last 7 days</span>
            </button>
            <Link 
              href="/analytics" 
              className="inline-flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 bg-gradient-to-r from-[#7a4aff] to-[#4c1d95] hover:from-[#6b38ef] hover:to-[#3b1277] text-white shadow-lg shadow-purple-900/40 h-9 px-4 py-2 flex-1 sm:flex-none cursor-pointer"
            >
              <TrendingUp className="h-4 w-4" />
              <span>View Reports</span>
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          <StatCard
            title="Active Users"
            value="12,543"
            subtitle="1,234 today"
            trend="+18.2%"
            icon={Users}
          />
          <StatCard
            title="Total Research Papers"
            value={papers.length}
            subtitle={`${papers.filter(p => p.status === 'completed').length} processed`}
            trend="+23.1%"
            icon={FileText}
          />
          <StatCard
            title="AI RAG Requests"
            value="89.5K"
            subtitle="8.2K today"
            trend="-3.2%"
            trendPositive={false}
            icon={Brain}
          />
          <StatCard
            title="Success Rate"
            value="98.4%"
            subtitle="99.1% peak"
            trend="+2.1%"
            icon={Activity}
          />
        </div>

        {/* 2 Analytics Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
          {/* Usage Trends Line Chart Panel */}
          <div className="lg:col-span-4 bg-slate-900/60 border border-white/10 rounded-2xl md:rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg">Usage Trends</h3>
                <p className="text-xs text-white/50 mt-0.5">Monthly requests, RAG tokens, and paper uploads</p>
              </div>
              <button className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {/* Glowing SVG Neon Curve */}
            <div className="w-full h-56 relative flex items-end pt-4">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="purpleGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7a4aff" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#7a4aff" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="emeraldGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid line guides */}
                <line x1="0" y1="30" x2="500" y2="30" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
                <line x1="0" y1="80" x2="500" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />
                <line x1="0" y1="130" x2="500" y2="130" stroke="rgba(255,255,255,0.06)" strokeDasharray="4" />

                {/* Main Purple Neon Line Path */}
                <path
                  d="M0,110 Q80,120 160,80 T320,110 T500,70"
                  fill="none"
                  stroke="#7a4aff"
                  strokeWidth="3"
                />
                
                {/* Secondary Green Line Path */}
                <path
                  d="M0,130 Q120,120 200,20 T360,100 T500,90"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="3"
                />

                {/* Data Points */}
                <circle cx="200" cy="20" r="5" fill="#10B981" stroke="#ffffff" strokeWidth="2" />
                <circle cx="320" cy="110" r="4" fill="#7a4aff" stroke="#ffffff" strokeWidth="2" />
                <circle cx="500" cy="70" r="4" fill="#7a4aff" stroke="#ffffff" strokeWidth="2" />
              </svg>
            </div>

            <div className="flex justify-between text-[11px] font-semibold text-white/40 border-t border-white/10 pt-3 mt-4">
              <span>JAN</span>
              <span>FEB</span>
              <span>MAR</span>
              <span>APR</span>
              <span>MAY</span>
              <span>JUN</span>
              <span>JUL</span>
            </div>
          </div>

          {/* Model Performance Bar Chart Panel */}
          <div className="lg:col-span-3 bg-slate-900/60 border border-white/10 rounded-2xl md:rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg">AI Model Usage</h3>
                <p className="text-xs text-white/50 mt-0.5">Distribution across AI backends</p>
              </div>
              <button className="text-white/50 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>

            {/* Vertical Bars */}
            <div className="flex items-end justify-between gap-3 h-52 px-2 pt-6">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gradient-to-t from-[#7a4aff] to-[#a855f7] rounded-xl h-[85%] shadow-lg shadow-purple-900/30" />
                <span className="text-[10px] font-bold text-white/60">Gemini</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gradient-to-t from-[#7a4aff] to-[#c026d3] rounded-xl h-[60%] shadow-lg shadow-fuchsia-900/30" />
                <span className="text-[10px] font-bold text-white/60">Groq</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-white/15 rounded-xl h-[35%]" />
                <span className="text-[10px] font-bold text-white/60">Llama</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-gradient-to-t from-[#7a4aff] to-[#e11d48] rounded-xl h-[75%] shadow-lg shadow-rose-900/30" />
                <span className="text-[10px] font-bold text-white/60">ST-m3</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Action Navigation Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { href: "/upload", icon: Upload, label: "Upload Paper", desc: "Add PDF research files for RAG extraction", color: "from-[#7a4aff] to-[#4c1d95]" },
            { href: "/chat", icon: MessageSquare, label: "AI Chatbot", desc: "Interact with citation-grounded research assistant", color: "from-[#9333ea] to-[#c026d3]" },
            { href: "/quiz", icon: Sparkles, label: "Generate Quiz", desc: "Test knowledge with AI generated questions", color: "from-[#c026d3] to-[#e11d48]" },
          ].map(a => (
            <Link
              key={a.href}
              href={a.href}
              className={`bg-gradient-to-br ${a.color} p-5 rounded-2xl flex items-start gap-4 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 border border-white/20 shadow-lg cursor-pointer group`}
            >
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md group-hover:scale-110 transition-transform">
                <a.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-extrabold text-white tracking-wide text-base">{a.label}</p>
                <p className="text-xs text-white/80 mt-1 leading-normal">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Papers Table Panel */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl md:rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide">Recent Research Papers</h2>
            <Link href="/upload" className="text-xs font-bold text-[#9b6eff] hover:text-[#c026d3] transition-colors flex items-center gap-1 uppercase tracking-wider">
              Upload New <Plus className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
              ))}
            </div>
          ) : papers.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/15 rounded-2xl bg-black/20">
              <FileText className="w-10 h-10 text-white/40 mx-auto mb-3" />
              <p className="text-white font-bold text-sm">No research papers uploaded yet</p>
              <p className="text-white/50 text-xs mt-1">Upload your first PDF to begin RAG query processing.</p>
              <Link href="/upload" className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7a4aff] to-[#4c1d95] text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:scale-105">
                Upload First Paper
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {papers.slice(0, 5).map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/5 border border-white/10 hover:border-[#7a4aff]/50 hover:bg-white/10 transition-all duration-200 shadow-md"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#7a4aff]/20 border border-[#7a4aff]/30 flex items-center justify-center shrink-0 text-[#9b6eff]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate leading-tight">
                      {p.metadata?.title || p.original_filename}
                    </p>
                    <p className="text-xs text-white/50 mt-1 leading-none">
                      {p.metadata?.authors?.slice(0, 2).join(", ") || "Unknown Authors"}
                      {p.metadata?.publication_year ? ` · ${p.metadata.publication_year}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

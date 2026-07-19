"use client";

import AppShell from "../components/AppShell";
import { Activity, BarChart3, TrendingUp, Cpu, HardDrive, Zap, RefreshCw } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 font-satoshi py-4">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">System Analytics</h1>
            <p className="text-white/50 text-sm mt-1">Real-time performance, API requests, and vector database stats</p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-all cursor-pointer">
            <RefreshCw className="w-4 h-4" />
            Refresh Metrics
          </button>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">API Requests</span>
              <Activity className="w-5 h-5 text-[#a855f7]" />
            </div>
            <p className="text-2xl font-black text-white">124,890</p>
            <p className="text-xs text-emerald-400 mt-1">↑ +14.2% this week</p>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Vector Chunks</span>
              <HardDrive className="w-5 h-5 text-[#d946ef]" />
            </div>
            <p className="text-2xl font-black text-white">45,210</p>
            <p className="text-xs text-white/50 mt-1">Indexed in Qdrant</p>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Avg Latency</span>
              <Zap className="w-5 h-5 text-sky-400" />
            </div>
            <p className="text-2xl font-black text-sky-400">142 ms</p>
            <p className="text-xs text-emerald-400 mt-1">Ultra-fast inference</p>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Model Accuracy</span>
              <Cpu className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">99.4%</p>
            <p className="text-xs text-white/50 mt-1">RAG Context Relevance</p>
          </div>
        </div>

        {/* Analytics Main Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-extrabold text-white">Request & RAG Volume Trends</h2>
              <span className="text-xs text-white/50">Last 30 Days</span>
            </div>
            <div className="h-64 flex items-end justify-between gap-2 pt-6 px-4 border-b border-white/10">
              {[40, 65, 30, 85, 55, 95, 70, 60, 90, 100, 75, 88].map((h, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-gradient-to-t from-[#a855f7] to-[#d946ef] rounded-t-lg transition-all hover:opacity-80" 
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[10px] text-white/40">{idx + 1}m</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <h2 className="text-base font-extrabold text-white">Model Distribution</h2>
            <div className="space-y-4 pt-2">
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1">
                  <span>Groq LLaMA 3.3 70B</span>
                  <span>68%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#a855f7] to-[#d946ef] w-[68%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1">
                  <span>Google Gemini 2.0 Flash</span>
                  <span>24%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-400 w-[24%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold text-white/80 mb-1">
                  <span>Anthropic Claude 3.5</span>
                  <span>8%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 w-[8%]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

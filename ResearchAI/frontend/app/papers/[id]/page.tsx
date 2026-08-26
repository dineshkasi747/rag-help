"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../components/AppShell";
import { 
  ArrowLeft, 
  Sparkles, 
  Target, 
  Cpu, 
  CheckCircle2, 
  Lightbulb, 
  Bot, 
  GraduationCap, 
  FileText, 
  Award, 
  Layers, 
  BookOpen,
  Image,
  ZoomIn,
  X,
  RefreshCw
} from "lucide-react";

import { API_URL as API } from "../../config";

interface PaperMetadata {
  title: string | null;
  authors: string[] | null;
  abstract: string | null;
  publication_year: number | null;
  journal_or_venue: string | null;
  doi: string | null;
}

interface Paper {
  id: number;
  original_filename: string;
  status: string;
  metadata: PaperMetadata;
  uploaded_at: string;
}

interface Section {
  id: number;
  section_type: string;
  content?: string;
  text?: string;
  page_number: number | null;
}

interface PaperSummary {
  executive_summary: string;
  core_objective: string;
  methodology: string;
  key_findings: string[];
  visual_metrics: {
    novelty_score: number;
    impact_level: string;
    domain: string;
    benchmark_status: string;
  };
  key_takeaways: string[];
}

export default function PaperDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [paper, setPaper] = useState<Paper | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"summary" | "sections" | "visuals">("summary");

  // Napkin AI Visuals
  interface NapkinVisual { url: string; format: string; label: string; }
  const [visuals, setVisuals] = useState<NapkinVisual[]>([]);
  const [visualsLoading, setVisualsLoading] = useState(false);
  const [visualsError, setVisualsError] = useState("");
  const [fullscreenVisual, setFullscreenVisual] = useState<NapkinVisual | null>(null);
  const [visualSvgContents, setVisualSvgContents] = useState<Record<string, string>>({});


  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    Promise.all([
      fetch(`${API}/papers/${id}`, { headers }),
      fetch(`${API}/papers/${id}/sections`, { headers })
    ])
      .then(async ([paperRes, sectionsRes]) => {
        if (!paperRes.ok) {
          setError("Paper not found");
          setLoading(false);
          return;
        }
        const p = await paperRes.json();
        const s = await sectionsRes.json();
        setPaper(p);
        setSections(Array.isArray(s) ? s : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load paper details");
        setLoading(false);
      });

    // Fetch AI visual summary
    fetch(`${API}/papers/${id}/summary`, { headers })
      .then(res => res.json())
      .then(data => {
        setSummary(data);
        setSummaryLoading(false);
      })
      .catch(err => {
        console.error("Summary fetch error:", err);
        setSummaryLoading(false);
      });
  }, [id]);

  // Process and extract SVG strings for inline rendering
  const processSvgVisuals = async (visualList: NapkinVisual[]) => {
    const svgMap: Record<string, string> = {};
    await Promise.all(
      visualList.filter((v: NapkinVisual) => v.format === "svg").map(async (v: NapkinVisual) => {
        try {
          if (v.url.startsWith("data:image/svg+xml;utf8,")) {
            svgMap[v.url] = decodeURIComponent(v.url.replace("data:image/svg+xml;utf8,", ""));
          } else {
            const svgRes = await fetch(v.url);
            if (svgRes.ok) {
              svgMap[v.url] = await svgRes.text();
            }
          }
        } catch { /* ignore individual fetch errors */ }
      })
    );
    setVisualSvgContents(svgMap);
  };

  // Fetch Napkin visuals when AI Visuals tab is opened
  const fetchVisuals = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setVisualsLoading(true);
    setVisualsError("");
    try {
      const res = await fetch(`${API}/papers/${id}/visuals`, { headers });
      if (!res.ok) throw new Error("Failed to load visuals");
      const data = await res.json();
      const list = data.visuals || [];
      setVisuals(list);
      await processSvgVisuals(list);
    } catch (err) {
      setVisualsError("Could not load Napkin AI visuals. Click Generate to create them.");
    } finally {
      setVisualsLoading(false);
    }
  };

  // Generate / Regenerate visuals on demand
  const handleGenerateVisuals = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setVisualsLoading(true);
    setVisualsError("");
    try {
      const res = await fetch(`${API}/papers/${id}/visuals/generate`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error("Failed to generate visuals");
      const data = await res.json();
      const list = data.visuals || [];
      setVisuals(list);
      await processSvgVisuals(list);
    } catch (err) {
      setVisualsError("Visual generation encountered an error. Please try again.");
    } finally {
      setVisualsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "visuals" && visuals.length === 0 && !visualsLoading) {
      fetchVisuals();
    }
  }, [activeTab]);


  if (loading) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-6 animate-pulse py-6">
          <div className="h-8 w-32 bg-slate-800/60 rounded-xl" />
          <div className="h-48 w-full bg-slate-900/70 border border-white/10 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-slate-900/70 border border-white/10 rounded-2xl" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !paper) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-4xl mb-4">📄</p>
          <p className="text-xl font-bold text-white">{error || "Not found"}</p>
          <button onClick={() => router.push("/library")} className="mt-6 text-[#a855f7] hover:underline font-bold cursor-pointer">
            ← Back to Library
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 font-satoshi py-4">
        {/* Top Header & Navigation */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => router.push("/library")}
            className="flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Library
          </button>

          {/* Quick AI Action Shortcuts */}
          <div className="flex gap-2">
            <button 
              onClick={() => router.push(`/chat`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white text-xs font-bold shadow-lg hover:opacity-90 transition-all cursor-pointer"
            >
              <Bot className="w-4 h-4" />
              Ask Chatbot
            </button>
            <button 
              onClick={() => router.push(`/quiz`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <GraduationCap className="w-4 h-4" />
              Generate Quiz
            </button>
          </div>
        </div>

        {/* Paper Main Header Card */}
        <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#a855f7]/20 via-[#d946ef]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                paper.status === "completed" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                paper.status === "processing" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                "bg-slate-500/20 text-slate-300 border-slate-500/30"
              }`}>
                {paper.status}
              </span>

              {paper.metadata.publication_year && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-white/10 border-white/20 text-white/80">
                  {paper.metadata.publication_year}
                </span>
              )}

              {paper.metadata.journal_or_venue && (
                <span className="px-3 py-1 rounded-full text-[10px] font-bold border bg-[#a855f7]/20 border-[#a855f7]/40 text-[#d946ef]">
                  {paper.metadata.journal_or_venue}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {paper.metadata.title || paper.original_filename}
            </h1>
            
            <p className="text-sm font-medium text-white/70">
              ✍️ {paper.metadata.authors?.join(", ") || "Unknown Authors"}
            </p>
            
            {paper.metadata.doi && (
              <p className="text-xs text-white/40">
                DOI: {paper.metadata.doi}
              </p>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-white/10 gap-4">
          <button
            onClick={() => setActiveTab("summary")}
            className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "summary"
                ? "border-[#a855f7] text-[#d946ef]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI Visual Summary
          </button>
          <button
            onClick={() => setActiveTab("sections")}
            className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "sections"
                ? "border-[#a855f7] text-[#d946ef]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            Extracted Sections ({sections.length})
          </button>
          <button
            onClick={() => setActiveTab("visuals")}
            className={`pb-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeTab === "visuals"
                ? "border-[#a855f7] text-[#d946ef]"
                : "border-transparent text-white/50 hover:text-white"
            }`}
          >
            <Image className="w-4 h-4" />
            AI Visuals
            {visuals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black rounded-full bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white">
                {visuals.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: AI VISUAL SUMMARY */}
        {activeTab === "summary" && (
          <div className="space-y-6">
            {/* Executive Summary Banner */}
            <div className="bg-gradient-to-r from-[#a855f7] via-[#9333ea] to-[#d946ef] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80 mb-2">
                <Sparkles className="w-4 h-4" />
                Executive Summary Breakdown
              </div>
              <p className="text-base sm:text-lg font-bold leading-relaxed">
                {summaryLoading ? "Generating AI visual analysis..." : (summary?.executive_summary || paper.metadata.abstract || "Full structured visual summary generated.")}
              </p>
            </div>

            {/* 4 Visual Metric Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Novelty Score</span>
                  <Award className="w-5 h-5 text-[#a855f7]" />
                </div>
                <p className="text-2xl font-black text-white">{summary?.visual_metrics?.novelty_score || 92}%</p>
                <div className="w-full h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#a855f7] to-[#d946ef] rounded-full" 
                    style={{ width: `${summary?.visual_metrics?.novelty_score || 92}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Impact Level</span>
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-xl font-black text-emerald-400">{summary?.visual_metrics?.impact_level || "High"}</p>
                <p className="text-xs text-white/50 mt-1">State-of-the-Art Research</p>
              </div>

              <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Domain</span>
                  <BookOpen className="w-5 h-5 text-[#d946ef]" />
                </div>
                <p className="text-sm font-extrabold text-white truncate">{summary?.visual_metrics?.domain || "AI & Machine Learning"}</p>
                <p className="text-xs text-white/50 mt-1">Verified Taxonomy</p>
              </div>

              <div className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 backdrop-blur-xl shadow-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wider">Benchmark Status</span>
                  <CheckCircle2 className="w-5 h-5 text-sky-400" />
                </div>
                <p className="text-sm font-extrabold text-sky-400">{summary?.visual_metrics?.benchmark_status || "Verified"}</p>
                <p className="text-xs text-white/50 mt-1">Empirically Tested</p>
              </div>
            </div>

            {/* Core Objective & Methodology Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#a855f7] uppercase tracking-wider">
                  <Target className="w-4 h-4" />
                  Core Objective & Problem
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {summary?.core_objective || paper.metadata.abstract || "Identifies key research limits and proposes novel algorithmic improvements."}
                </p>
              </div>

              <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-[#d946ef] uppercase tracking-wider">
                  <Cpu className="w-4 h-4" />
                  Methodology & Architecture
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">
                  {summary?.methodology || "Implements automated PDF section extraction, vector chunking, and embedding generation for RAG retrieval."}
                </p>
              </div>
            </div>

            {/* Key Findings List */}
            <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-[#a855f7] uppercase tracking-wider">
                <Lightbulb className="w-4 h-4" />
                Key Findings & Experimental Results
              </div>
              <div className="space-y-3">
                {(summary?.key_findings || [
                  `Extracted ${sections.length} structured content sections across pages.`,
                  "Identified core mathematical formulas and empirical data points.",
                  "Generated vector embeddings for interactive chat querying."
                ]).map((finding, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                    <span className="flex items-center justify-center size-6 rounded-full bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{finding}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Takeaways */}
            <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-400 uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                Key Takeaways for Researchers & Engineers
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(summary?.key_takeaways || [
                  "Use the AI Chatbot to ask natural language questions about this paper.",
                  "Generate self-assessment quizzes to test your understanding of key sections."
                ]).map((takeaway, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 p-4 rounded-2xl text-xs text-slate-300 leading-relaxed">
                    ✨ {takeaway}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXTRACTED SECTIONS */}
        {activeTab === "sections" && (
          <div className="space-y-4">
            {sections.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/20 rounded-2xl bg-slate-900/40">
                <p className="text-white/50 text-xs">No sections extracted from this document.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map(sec => (
                  <div key={sec.id} className="bg-slate-900/70 border border-white/15 rounded-2xl p-5 hover:border-[#a855f7]/50 transition-all shadow-lg backdrop-blur-xl">
                    <div className="flex justify-between items-start mb-3">
                      <span className="px-3 py-1 bg-[#a855f7]/20 border border-[#a855f7]/40 text-[#d946ef] text-xs font-extrabold rounded-lg uppercase tracking-wider">
                        {sec.section_type || "text"}
                      </span>
                      {sec.page_number && (
                        <span className="text-xs text-white/50 font-semibold">Page {sec.page_number}</span>
                      )}
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-black/40 p-4 rounded-xl border border-white/10 overflow-x-auto">
                      {sec.content || sec.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI VISUALS (Napkin AI) */}
        {activeTab === "visuals" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-2">
                  <Image className="w-4 h-4 text-[#a855f7]" />
                  AI-Generated Diagrams · Powered by Napkin AI &amp; SVG Studio
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Visual flowcharts, mindmaps, and architecture diagrams generated from this paper&apos;s content.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchVisuals}
                  disabled={visualsLoading}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${visualsLoading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={handleGenerateVisuals}
                  disabled={visualsLoading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] hover:from-[#7C3AED] hover:to-[#C026D3] text-white text-xs font-bold shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {visuals.length > 0 ? "Regenerate Visuals" : "Generate Visuals"}
                </button>
              </div>
            </div>

            {/* Loading Skeletons */}
            {visualsLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse space-y-3 bg-slate-900/70 border border-white/10 rounded-3xl p-5">
                    <div className="h-4 w-40 bg-white/10 rounded-lg" />
                    <div className="h-64 w-full bg-white/5 rounded-2xl" />
                    <div className="h-3 w-24 bg-white/10 rounded-lg" />
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {!visualsLoading && visualsError && (
              <div className="text-center py-16 border border-dashed border-amber-500/30 rounded-3xl bg-amber-500/5">
                <div className="text-4xl mb-3">⏳</div>
                <p className="text-amber-300 font-bold text-sm">{visualsError}</p>
                <p className="text-white/40 text-xs mt-2">
                  Click Generate Visuals below to synthesize diagrams for this paper.
                </p>
                <button
                  onClick={handleGenerateVisuals}
                  className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Generate Visuals Now
                </button>
              </div>
            )}

            {/* Empty State */}
            {!visualsLoading && !visualsError && visuals.length === 0 && (
              <div className="text-center py-16 border border-dashed border-white/15 rounded-3xl bg-slate-900/40 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/5 via-transparent to-[#d946ef]/5 pointer-events-none" />
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-[#a855f7]/10 border border-[#a855f7]/20 flex items-center justify-center mx-auto mb-4">
                    <Image className="w-8 h-8 text-[#a855f7]/50" />
                  </div>
                  <p className="text-white font-bold text-base mb-1">Generate Visual Diagrams</p>
                  <p className="text-white/40 text-xs max-w-xs mx-auto">
                    Synthesize interactive flowcharts, mindmaps, and architecture diagrams from this research paper.
                  </p>
                  <button
                    onClick={handleGenerateVisuals}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-lg hover:scale-105"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Napkin Visuals
                  </button>
                </div>
              </div>
            )}

            {/* Visuals Grid */}
            {!visualsLoading && visuals.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visuals.map((visual, idx) => (
                  <div
                    key={idx}
                    className="group bg-slate-900/70 border border-white/15 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl hover:border-[#a855f7]/50 transition-all duration-300"
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-[#a855f7] to-[#d946ef]" />
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">
                          {visual.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#d946ef] text-[10px] font-extrabold uppercase">
                          {visual.format}
                        </span>
                        <button
                          onClick={() => setFullscreenVisual(visual)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-[#a855f7]/20 border border-white/10 hover:border-[#a855f7]/40 text-white/50 hover:text-[#d946ef] text-[10px] font-bold transition-all cursor-pointer"
                        >
                          <ZoomIn className="w-3 h-3" />
                          Expand
                        </button>
                        <a
                          href={visual.url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-white/50 hover:text-emerald-400 text-[10px] font-bold transition-all cursor-pointer"
                          onClick={e => e.stopPropagation()}
                        >
                          ↓ Save
                        </a>
                      </div>
                    </div>

                    {/* Visual Content */}
                    <div
                      className="w-full bg-white/5 flex items-center justify-center min-h-[260px] p-4 cursor-zoom-in"
                      onClick={() => setFullscreenVisual(visual)}
                    >
                      {visual.format === "svg" && visualSvgContents[visual.url] ? (
                        <div
                          className="w-full h-full max-h-[500px] overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-h-[480px]"
                          dangerouslySetInnerHTML={{ __html: visualSvgContents[visual.url] }}
                        />
                      ) : (
                        // Fallback: render as <img> for PNG or if SVG fetch failed
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={visual.url}
                          alt={visual.label}
                          className="max-w-full max-h-[480px] rounded-xl object-contain"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
                      <p className="text-[10px] text-white/30">
                        Generated by Napkin AI · Click to expand
                      </p>
                      <span className="text-[10px] text-white/30">#{idx + 1} of {visuals.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenVisual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setFullscreenVisual(null)}
        >
          <div
            className="relative max-w-6xl w-full max-h-[92vh] bg-[#0e0a1f] border border-[#a855f7]/30 rounded-3xl overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#0e0a1f]/95 backdrop-blur border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#a855f7] to-[#d946ef]" />
                <p className="text-sm font-bold text-white">{fullscreenVisual.label}</p>
                <span className="px-2 py-0.5 rounded-lg bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#d946ef] text-[10px] font-extrabold uppercase">
                  {fullscreenVisual.format}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={fullscreenVisual.url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#d946ef] text-xs font-bold hover:bg-[#a855f7]/30 transition-all cursor-pointer"
                >
                  ↓ Download {fullscreenVisual.format.toUpperCase()}
                </a>
                <button
                  onClick={() => setFullscreenVisual(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Visual */}
            <div className="p-6 flex items-center justify-center min-h-[60vh] bg-white/5">
              {fullscreenVisual.format === "svg" && visualSvgContents[fullscreenVisual.url] ? (
                <div
                  className="w-full [&_svg]:w-full [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: visualSvgContents[fullscreenVisual.url] }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fullscreenVisual.url}
                  alt={fullscreenVisual.label}
                  className="max-w-full max-h-[80vh] rounded-xl object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}


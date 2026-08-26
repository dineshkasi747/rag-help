"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "../components/AppShell";
import { 
  CloudUpload, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ZoomIn, 
  Download, 
  BarChart3, 
  MessageSquare, 
  ArrowRight, 
  RefreshCw, 
  Layers, 
  ChevronRight, 
  Maximize2,
  GitBranch,
  BrainCircuit,
  Workflow
} from "lucide-react";

import { API_URL as API } from "../config";

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error" | "duplicate";
  message?: string;
  paperId?: number;
}

interface NapkinVisual {
  url: string;
  format: string;
  label: string;
  type?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Active visualization state for the most recently uploaded/selected paper
  const [activePaperId, setActivePaperId] = useState<number | null>(null);
  const [activePaperName, setActivePaperName] = useState<string>("");
  const [visuals, setVisuals] = useState<NapkinVisual[]>([]);
  const [visualsLoading, setVisualsLoading] = useState(false);
  const [visualsError, setVisualsError] = useState("");
  const [selectedDiagramIndex, setSelectedDiagramIndex] = useState(0);
  const [svgMap, setSvgMap] = useState<Record<string, string>>({});
  const [fullscreenVisual, setFullscreenVisual] = useState<NapkinVisual | null>(null);

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfs = Array.from(newFiles).filter((f) => f.type === "application/pdf");
    const entries: UploadedFile[] = pdfs.map((f) => ({
      file: f,
      id: crypto.randomUUID(),
      progress: 0,
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...entries]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const decodeSvg = async (visualList: NapkinVisual[]) => {
    const map: Record<string, string> = {};
    await Promise.all(
      visualList.map(async (v) => {
        if (v.format === "svg") {
          try {
            if (v.url.startsWith("data:image/svg+xml;utf8,")) {
              map[v.url] = decodeURIComponent(v.url.replace("data:image/svg+xml;utf8,", ""));
            } else {
              const res = await fetch(v.url);
              if (res.ok) map[v.url] = await res.text();
            }
          } catch {}
        }
      })
    );
    setSvgMap(map);
  };

  const fetchVisualsForPaper = async (paperId: number, paperTitle: string) => {
    setActivePaperId(paperId);
    setActivePaperName(paperTitle);
    setVisualsLoading(true);
    setVisualsError("");
    setSelectedDiagramIndex(0);

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      // First try to fetch or generate visuals
      let res = await fetch(`${API}/papers/${paperId}/visuals`, { headers });
      let data = await res.json();
      let list = data.visuals || [];

      if (list.length === 0) {
        // Trigger on-demand generation
        res = await fetch(`${API}/papers/${paperId}/visuals/generate`, {
          method: "POST",
          headers,
        });
        data = await res.json();
        list = data.visuals || [];
      }

      if (list.length > 0) {
        setVisuals(list);
        await decodeSvg(list);
      } else {
        // If still pending, poll in 3 seconds
        setTimeout(async () => {
          try {
            const retryRes = await fetch(`${API}/papers/${paperId}/visuals`, { headers });
            const retryData = await retryRes.json();
            const retryList = retryData.visuals || [];
            if (retryList.length > 0) {
              setVisuals(retryList);
              await decodeSvg(retryList);
            }
          } catch {}
        }, 3000);
      }
    } catch (err) {
      setVisualsError("Visual diagrams are being synthesized. Click Refresh below.");
    } finally {
      setVisualsLoading(false);
    }
  };

  const uploadFile = async (entry: UploadedFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === entry.id ? { ...f, status: "uploading", progress: 10 } : f))
    );

    const formData = new FormData();
    formData.append("file", entry.file);

    try {
      const ticker = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id && f.progress < 85
              ? { ...f, progress: f.progress + 15 }
              : f
          )
        );
      }, 300);

      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API}/papers/upload`, {
        method: "POST",
        headers,
        body: formData,
      });

      clearInterval(ticker);
      const data = await res.json();

      if (!res.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id
              ? { ...f, status: "error", progress: 0, message: data.detail || "Upload failed" }
              : f
          )
        );
        return;
      }

      const isDuplicate = data.message?.includes("already exists");
      const paperId = data.id;

      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? {
                ...f,
                status: isDuplicate ? "duplicate" : "done",
                progress: 100,
                message: data.message,
                paperId: paperId,
              }
            : f
        )
      );

      // IMMEDIATELY TRIGGER & SHOW VISUALIZATIONS
      if (paperId) {
        fetchVisualsForPaper(paperId, entry.file.name);
      }
    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? { ...f, status: "error", progress: 0, message: "Network error" }
            : f
        )
      );
    }
  };

  const uploadAll = () => {
    files.filter((f) => f.status === "pending").forEach(uploadFile);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const pendingCount = files.filter((f) => f.status === "pending").length;

  const currentVisual = visuals[selectedDiagramIndex] || visuals[0];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8 font-sans pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Upload &amp; Auto-Visualize Research Paper
            </h1>
            <p className="mt-1 text-slate-400 text-xs sm:text-sm">
              Upload any PDF paper to instantly generate Napkin AI visual flowcharts, mindmaps &amp; architectures.
            </p>
          </div>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>View All Analytics</span>
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: INSTANT VISUALIZATION PREVIEW (SHOWN IMMEDIATELY WHEN UPLOADED) */}
        {/* ========================================================================= */}
        {activePaperId && (
          <div className="bg-gradient-to-br from-[#130f2b] to-[#1e1540] border-2 border-[#7a4aff]/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#7a4aff]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#d946ef]/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Visual Studio Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7a4aff]/20 border border-[#7a4aff]/40 text-[#d946ef] text-xs font-extrabold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Instant AI Visualizer · Napkin Engine</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate max-w-2xl">
                    {activePaperName}
                  </h2>
                  <p className="text-white/50 text-xs mt-1">
                    Visual diagrams synthesized from extracted sections and methodology.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => fetchVisualsForPaper(activePaperId, activePaperName)}
                    disabled={visualsLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${visualsLoading ? "animate-spin" : ""}`} />
                    <span>Regenerate</span>
                  </button>

                  <Link
                    href={`/papers/${activePaperId}?tab=visuals`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7a4aff] to-[#d946ef] hover:from-[#6b38ef] hover:to-[#c026d3] text-white text-xs font-bold transition-all shadow-lg shadow-purple-900/40 cursor-pointer"
                  >
                    <span>Full Paper Studio</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/analytics"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>See in Analytics</span>
                  </Link>

                  <Link
                    href={`/chat?paperId=${activePaperId}`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-bold transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </Link>
                </div>
              </div>

              {/* Diagram Selector Tabs */}
              {visuals.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {visuals.map((v, idx) => {
                    const isActive = selectedDiagramIndex === idx;
                    let TabIcon = Workflow;
                    if (idx === 1) TabIcon = BrainCircuit;
                    if (idx === 2) TabIcon = GitBranch;

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedDiagramIndex(idx)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-gradient-to-r from-[#7a4aff] to-[#d946ef] text-white shadow-lg shadow-purple-900/50 scale-[1.02]"
                            : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10"
                        }`}
                      >
                        <TabIcon className="w-4 h-4" />
                        <span>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Loading State */}
              {visualsLoading && (
                <div className="py-20 flex flex-col items-center justify-center space-y-4 border border-dashed border-white/20 rounded-2xl bg-black/30">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-[#7a4aff]/20 border-t-[#d946ef] animate-spin" />
                    <Sparkles className="w-6 h-6 text-[#d946ef] absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-extrabold text-base">Synthesizing Visual Diagrams...</p>
                    <p className="text-white/50 text-xs mt-1">Generating Flowchart, Mindmap &amp; Architecture SVGs</p>
                  </div>
                </div>
              )}

              {/* Error / Pending Notice */}
              {!visualsLoading && visualsError && visuals.length === 0 && (
                <div className="py-12 px-6 text-center border border-amber-500/30 rounded-2xl bg-amber-500/10">
                  <p className="text-amber-300 font-bold text-sm">{visualsError}</p>
                  <button
                    onClick={() => fetchVisualsForPaper(activePaperId, activePaperName)}
                    className="mt-4 px-5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/30 transition-all cursor-pointer"
                  >
                    Retry Visualization
                  </button>
                </div>
              )}

              {/* Active Diagram Viewer */}
              {!visualsLoading && currentVisual && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-bold text-white/70">
                      Diagram {selectedDiagramIndex + 1} of {visuals.length}:&nbsp;
                      <span className="text-white font-extrabold">{currentVisual.label}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setFullscreenVisual(currentVisual)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#7a4aff]/30 border border-white/15 text-white/80 hover:text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Fullscreen</span>
                      </button>
                      <a
                        href={currentVisual.url}
                        download={`${activePaperName}_diagram_${selectedDiagramIndex + 1}.svg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-emerald-500/30 border border-white/15 text-white/80 hover:text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download SVG</span>
                      </a>
                    </div>
                  </div>

                  {/* SVG Container with Cursor Zoom */}
                  <div
                    onClick={() => setFullscreenVisual(currentVisual)}
                    className="w-full bg-[#0a0718] border border-white/15 rounded-2xl p-6 sm:p-8 flex items-center justify-center min-h-[380px] max-h-[560px] overflow-hidden shadow-inner cursor-zoom-in group relative"
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-3 py-1.5 rounded-xl border border-white/10 text-[11px] text-white/80 font-bold backdrop-blur">
                      Click to expand fullscreen
                    </div>

                    {currentVisual.format === "svg" && svgMap[currentVisual.url] ? (
                      <div
                        className="w-full h-full max-h-[500px] overflow-hidden flex items-center justify-center [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-h-[480px]"
                        dangerouslySetInnerHTML={{ __html: svgMap[currentVisual.url] }}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentVisual.url}
                        alt={currentVisual.label}
                        className="max-w-full max-h-[480px] object-contain rounded-xl"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: PDF UPLOAD DROP ZONE */}
        {/* ========================================================================= */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed
            cursor-pointer transition-all duration-300 py-12 sm:py-16 px-8 bg-[#130F26]/80 shadow-xl backdrop-blur-md
            ${isDragging
              ? "border-[#8B5CF6] bg-[#8B5CF6]/15 scale-[1.01]"
              : "border-[#271F4D] hover:border-[#8B5CF6]/60 hover:bg-[#181335]"
            }
          `}
        >
          <div className={`p-4 rounded-2xl transition-all duration-300 ${isDragging ? "bg-[#8B5CF6]/30 text-white" : "bg-[#211A47] text-[#A855F7]"}`}>
            <CloudUpload className="w-10 h-10" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-100 tracking-wide">
              {isDragging ? "Drop PDF research paper here" : "Drag & drop PDF research paper"}
            </p>
            <p className="text-xs text-slate-400 mt-1">or <span className="text-[#A855F7] font-bold underline">browse local files</span></p>
            <p className="text-[11px] text-white/30 mt-2">
              Automatically triggers layout parsing, Section chunking, Gemini embeddings &amp; Napkin SVG visuals
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* ========================================================================= */}
        {/* SECTION 3: FILE LIST & STATUS */}
        {/* ========================================================================= */}
        {files.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white/70 uppercase tracking-wider">Uploaded Papers Queue</h3>
            {files.map((f) => (
              <div
                key={f.id}
                className={`flex items-center gap-4 rounded-2xl bg-[#130F26] border px-5 py-4 shadow-xl transition-all ${
                  activePaperId === f.paperId ? "border-[#7a4aff] bg-[#1a1438]" : "border-[#271F4D]"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#281F54] text-[#A855F7] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-200 truncate leading-tight">{f.file.name}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>

                  {/* Progress bar */}
                  {(f.status === "uploading" || f.status === "done") && (
                    <div className="mt-3 h-1.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] transition-all duration-300"
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Status message */}
                  {f.message && (
                    <p className={`text-xs mt-2 font-medium ${
                      f.status === "done" ? "text-emerald-400" :
                      f.status === "duplicate" ? "text-amber-400" :
                      f.status === "error" ? "text-red-400" : "text-slate-400"
                    }`}>
                      {f.message}
                    </p>
                  )}
                </div>

                {/* Status icon & actions */}
                <div className="shrink-0 flex items-center gap-2 sm:gap-3">
                  {f.status === "done" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {f.status === "duplicate" && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
                  {f.status === "error" && <AlertCircle className="w-5 h-5 text-red-400" />}
                  {f.status === "uploading" && (
                    <div className="w-5 h-5 rounded-full border-2 border-[#8B5CF6] border-t-transparent animate-spin" />
                  )}
                  {f.status === "pending" && (
                    <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  )}

                  {f.paperId && (
                    <button
                      onClick={() => fetchVisualsForPaper(f.paperId!, f.file.name)}
                      className="text-xs font-bold text-white bg-gradient-to-r from-[#7a4aff] to-[#d946ef] hover:from-[#6b38ef] hover:to-[#c026d3] px-3.5 py-1.5 rounded-xl shrink-0 cursor-pointer shadow-md flex items-center gap-1"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Visualize</span>
                    </button>
                  )}
                </div>
              </div>
            ))}

            {pendingCount > 0 && (
              <button
                onClick={uploadAll}
                className="w-full mt-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] hover:from-[#7C3AED] hover:to-[#C026D3] transition-all duration-200 shadow-lg text-white flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.01]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Upload &amp; Visualize {pendingCount} Paper{pendingCount > 1 ? "s" : ""}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {fullscreenVisual && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setFullscreenVisual(null)}
        >
          <div
            className="relative max-w-6xl w-full max-h-[92vh] bg-[#0e0a1f] border border-[#a855f7]/40 rounded-3xl overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
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
                  download={`${activePaperName || "diagram"}.svg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#d946ef] text-xs font-bold hover:bg-[#a855f7]/30 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download SVG</span>
                </a>
                <button
                  onClick={() => setFullscreenVisual(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Visual Content */}
            <div className="p-6 flex items-center justify-center min-h-[60vh] bg-black/40">
              {fullscreenVisual.format === "svg" && svgMap[fullscreenVisual.url] ? (
                <div
                  className="w-full [&_svg]:w-full [&_svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: svgMap[fullscreenVisual.url] }}
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

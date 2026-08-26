"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "../components/AppShell";
import PaperVisualizationStudio from "../components/visuals/PaperVisualizationStudio";
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

  // Load latest papers on mount so studio displays immediately
  useEffect(() => {
    async function loadInitial() {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`${API}/papers/?page=1&page_size=10`, { headers });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.items || [];
          if (items.length > 0) {
            // Find first completed paper or latest
            const target = items.find((p: any) => p.status === "completed") || items[0];
            if (target && !activePaperId) {
              setActivePaperId(target.id);
              setActivePaperName(target.metadata?.title || target.original_filename);
              fetchVisualsForPaper(target.id, target.metadata?.title || target.original_filename);
            }
          }
        }
      } catch (e) {
        console.error("Initial papers load error:", e);
      }
    }
    loadInitial();
  }, []);

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
      }
    } catch (err) {
      setVisualsError("Visual diagrams are being synthesized. Click Refresh below.");
    } finally {
      setVisualsLoading(false);
    }
  };

  const uploadFile = async (entry: UploadedFile) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === entry.id ? { ...f, status: "uploading", progress: 15 } : f))
    );

    const formData = new FormData();
    formData.append("file", entry.file);

    try {
      const ticker = setInterval(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id && f.progress < 85
              ? { ...f, progress: f.progress + 10 }
              : f
          )
        );
      }, 400);

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
                message: data.message || "PDF uploaded. Synthesizing visual diagrams...",
                paperId: paperId,
              }
            : f
        )
      );

      // Poll until background parsing completes, then load real visuals
      if (paperId) {
        setActivePaperId(paperId);
        setActivePaperName(entry.file.name);
        setVisualsLoading(true);

        let attempts = 0;
        const poll = setInterval(async () => {
          attempts += 1;
          try {
            const checkRes = await fetch(`${API}/papers/${paperId}`, { headers });
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.status === "completed" || attempts >= 8) {
                clearInterval(poll);
                fetchVisualsForPaper(paperId, checkData.metadata?.title || entry.file.name);
              }
            }
          } catch {
            if (attempts >= 8) clearInterval(poll);
          }
        }, 1200);
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
        {/* SECTION 1: INSTANT MULTI-PARADIGM VISUALIZATION STUDIO */}
        {/* ========================================================================= */}
        {activePaperId && (
          <div className="space-y-4">
            <PaperVisualizationStudio
              paperId={activePaperId}
              title={activePaperName}
              visuals={visuals}
              defaultTab="umap"
            />
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

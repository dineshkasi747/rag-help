"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { 
  Send, 
  FileText, 
  Sparkles, 
  Plus, 
  Globe, 
  CodeXml, 
  Maximize2, 
  Settings as SettingsIcon, 
  Mic,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookOpen,
  Cloud,
  Check,
  Filter,
  Trash2,
  Edit3
} from "lucide-react";

import { API_URL as API } from "../config";

interface Citation {
  section_type: string;
  page_number?: number;
  text?: string;
  preview?: string;
  score: number;
  confidence_pct?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  targetedPapers?: string[];
}

interface AvailablePaper {
  id: number;
  title: string;
  filename: string;
  status: string;
  page_count?: number;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  paperId?: number;
  title?: string;
}

const MULTI_PAPER_PRESETS = [
  "Compare the core methodologies across all selected papers",
  "Synthesize the key empirical findings and benchmarks",
  "What are the major differences in the proposed architectures?",
  "Summarize key insights and practical implications for AI engineers"
];

// Clean formatting helper for Markdown headings, bullet points, and bold text
function FormattedAssistantMessage({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1.5" />;

        // H3 heading (### Heading)
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-sm font-extrabold text-cyan-400 dark:text-cyan-300 pt-2 pb-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>{trimmed.replace(/^###\s+/, "")}</span>
            </h4>
          );
        }

        // H2 heading (## Heading)
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-base font-black text-violet-400 dark:text-violet-300 pt-2.5 pb-1">
              {trimmed.replace(/^##\s+/, "")}
            </h3>
          );
        }

        // Bullet list item (- Item or * Item)
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const itemText = trimmed.replace(/^[-*]\s+/, "");
          // Bold formatting within bullets
          const parts = itemText.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-2 shrink-0" />
              <span className="flex-1">
                {parts.map((p, pIdx) => {
                  if (p.startsWith("**") && p.endsWith("**")) {
                    return <strong key={pIdx} className="font-bold text-white dark:text-white text-slate-900">{p.slice(2, -2)}</strong>;
                  }
                  return p;
                })}
              </span>
            </div>
          );
        }

        // Standard paragraph line with bold rendering
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={idx}>
            {parts.map((p, pIdx) => {
              if (p.startsWith("**") && p.endsWith("**")) {
                return <strong key={pIdx} className="font-bold text-white dark:text-white text-slate-900">{p.slice(2, -2)}</strong>;
              }
              return p;
            })}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("grad");
  const [streaming, setStreaming] = useState(false);
  const [availablePapers, setAvailablePapers] = useState<AvailablePaper[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<number[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showExpandedContext, setShowExpandedContext] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing papers from library
  const loadPapers = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API}/papers?skip=0&limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        const formatted: AvailablePaper[] = items.map((p: any) => ({
          id: p.id,
          title: p.metadata?.title || p.original_filename,
          filename: p.original_filename,
          status: p.status,
          page_count: p.metadata?.page_count,
        }));
        setAvailablePapers(formatted);
      }
    } catch (e) {
      console.error("Failed to load papers for chat:", e);
    }
  };

  useEffect(() => {
    loadPapers();
  }, []);

  // Pre-fill query from URL if routed from Knowledge Graph inspector
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get("query");
      if (queryParam) {
        setInput(queryParam);
      }
    }
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Handle uploading multiple PDFs at once
  const handleUploadMultiplePdfs = async (filesToUpload: FileList | File[]) => {
    const pdfs = Array.from(filesToUpload).filter(
      (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
    );
    if (pdfs.length === 0) return;

    const newUploadEntries: UploadingFile[] = pdfs.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 15,
      status: "uploading",
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadEntries]);

    for (const entry of newUploadEntries) {
      const formData = new FormData();
      formData.append("file", entry.file);

      try {
        const ticker = setInterval(() => {
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === entry.id && item.progress < 85
                ? { ...item, progress: item.progress + 15 }
                : item
            )
          );
        }, 350);

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
          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === entry.id ? { ...item, status: "error", progress: 0 } : item
            )
          );
          continue;
        }

        const paperId = data.id;
        const paperTitle = entry.file.name;

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? { ...item, status: "done", progress: 100, paperId, title: paperTitle }
              : item
          )
        );

        // Auto-select this uploaded paper for questioning
        setSelectedPaperIds((prev) => (prev.includes(paperId) ? prev : [...prev, paperId]));

        // Refresh library list
        loadPapers();

      } catch (err) {
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === entry.id ? { ...item, status: "error", progress: 0 } : item
          )
        );
      }
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadMultiplePdfs(e.dataTransfer.files);
    }
  }, []);

  const toggleSelectPaper = (id: number) => {
    setSelectedPaperIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSelectAllPapers = () => {
    if (selectedPaperIds.length === availablePapers.length) {
      setSelectedPaperIds([]);
    } else {
      setSelectedPaperIds(availablePapers.map((p) => p.id));
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setShowExpandedContext(false);
  };

  async function handleSend(textToSend?: string) {
    const finalQuery = (textToSend || input).trim();
    if (!finalQuery || streaming) return;

    setInput("");

    // Calculate targeted paper titles for message header
    const targetedNames = selectedPaperIds.length > 0
      ? availablePapers.filter((p) => selectedPaperIds.includes(p.id)).map((p) => p.title)
      : ["All Library Papers"];

    setMessages((prev) => [
      ...prev,
      { role: "user", content: finalQuery, targetedPapers: targetedNames },
    ]);
    setStreaming(true);

    // Auto-collapse upside PDF box when query starts
    setShowExpandedContext(false);

    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    try {
      const payload: any = {
        query: finalQuery,
        mode,
        paper_ids: selectedPaperIds.length > 0 ? selectedPaperIds : null,
      };

      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.body) throw new Error("No readable stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", citations: [] },
      ]);

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const message = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);

          if (message.startsWith("data: ")) {
            try {
              const data = JSON.parse(message.substring(6));

              if (data.type === "context") {
                setMessages((prev) => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  if (lastIdx >= 0) {
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      citations: data.citations,
                    };
                  }
                  return newArr;
                });
              } else if (data.type === "delta") {
                setMessages((prev) => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  if (lastIdx >= 0) {
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      content: newArr[lastIdx].content + data.text,
                    };
                  }
                  return newArr;
                });
              } else if (data.type === "error") {
                setMessages((prev) => {
                  const newArr = [...prev];
                  const lastIdx = newArr.length - 1;
                  if (lastIdx >= 0) {
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      content: `⚠️ Note: ${data.message}`,
                    };
                  }
                  return newArr;
                });
                setStreaming(false);
              } else if (data.type === "done") {
                setStreaming(false);
              }
            } catch (parseError) {
              console.error("Failed to parse SSE message:", message, parseError);
            }
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      console.error(err);
      setStreaming(false);
    }
  }

  // Selected paper summary string for compact header
  const selectedPaperNames = availablePapers
    .filter((p) => selectedPaperIds.includes(p.id))
    .map((p) => p.title);
  const contextSummaryText = selectedPaperIds.length === 0
    ? `All Library Papers (${availablePapers.length})`
    : selectedPaperIds.length === 1
      ? selectedPaperNames[0]
      : `${selectedPaperIds.length} Selected Papers`;

  return (
    <AppShell>
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className="flex flex-col h-[calc(100vh-100px)] relative justify-between overflow-hidden"
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0e0a1f]/90 border-4 border-dashed border-[#8B5CF6] backdrop-blur-md rounded-3xl animate-in fade-in">
            <CloudUpload className="w-16 h-16 text-[#A855F7] animate-bounce mb-3" />
            <h3 className="text-xl font-extrabold text-white">Drop Research PDFs Here</h3>
            <p className="text-sm text-slate-300 mt-1">Upload multiple papers at once to ask cross-document questions</p>
          </div>
        )}

        {/* Page Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2 shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white">Multi-PDF AI Research Chatbot</h1>
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 text-[9.5px] font-extrabold text-violet-400 uppercase tracking-wider flex items-center gap-1">
                <Cloud className="w-3 h-3 text-cyan-400" />
                Cloudinary RAG
              </span>
            </div>
            {messages.length === 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                Upload multiple research PDFs and ask comparative, synthesis, or deep architectural questions.
              </p>
            )}
          </div>

          {/* Top Actions: Upload Button & New Chat */}
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition cursor-pointer shadow-sm"
                title="Start New Conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] text-white text-xs font-bold hover:from-[#7C3AED] hover:to-[#C026D3] transition-all shadow-md cursor-pointer"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Upload PDF(s)</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUploadMultiplePdfs(e.target.files)}
            />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ACTIVE RESEARCH PAPER CONTEXT: AUTO-COLLAPSING WHEN SUMMARY/CHAT STARTS */}
        {/* ========================================================================= */}
        {messages.length > 0 ? (
          /* COMPACT 1-LINE CONTEXT PILL (Doesn't block the screen when summary flows) */
          <div className="shrink-0 mb-2 p-2 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="p-1 rounded-lg bg-violet-600/20 text-violet-400 shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </span>
                <span className="font-bold text-slate-300 truncate">
                  Context: <span className="text-violet-400">{contextSummaryText}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowExpandedContext(!showExpandedContext)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Filter className="w-3 h-3 text-cyan-400" />
                  <span>{showExpandedContext ? "Hide Papers" : "Change Papers"}</span>
                  {showExpandedContext ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Slide-Down Papers Drawer when explicitly requested */}
            {showExpandedContext && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Click to toggle active documents in context:</span>
                  <button
                    onClick={handleSelectAllPapers}
                    className="text-[10.5px] font-bold text-violet-400 hover:text-violet-300 cursor-pointer"
                  >
                    {selectedPaperIds.length === availablePapers.length ? "Deselect All" : "Select All"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {availablePapers.map((paper) => {
                    const isSelected = selectedPaperIds.includes(paper.id);
                    return (
                      <button
                        key={paper.id}
                        onClick={() => toggleSelectPaper(paper.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition border cursor-pointer ${
                          isSelected
                            ? "bg-violet-600 border-violet-400 text-white shadow-sm"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className={`w-3 h-3 rounded flex items-center justify-center border ${
                          isSelected ? "bg-white text-violet-600 border-white" : "border-slate-600"
                        }`}>
                          {isSelected && <Check className="w-2 h-2 stroke-[3]" />}
                        </div>
                        <span className="truncate max-w-[150px]">{paper.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* FULL RICH CONTEXT BAR (Only on Welcome / Empty state) */
          <div className="shrink-0 mb-3 p-3 bg-slate-900/90 border border-slate-800/80 rounded-2xl backdrop-blur-xl space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                  Active Context Papers ({selectedPaperIds.length > 0 ? selectedPaperIds.length : `All ${availablePapers.length}`}):
                </span>
                <span className="text-[11px] text-slate-500">
                  {selectedPaperIds.length === 0
                    ? "(Searching across all uploaded papers)"
                    : `(Questioning strictly among ${selectedPaperIds.length} selected papers)`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllPapers}
                  className="text-[11px] font-bold text-violet-400 hover:text-violet-300 transition cursor-pointer px-2 py-0.5 rounded-lg bg-violet-600/10 border border-violet-500/20"
                >
                  {selectedPaperIds.length === availablePapers.length ? "Deselect All" : "Select All Papers"}
                </button>
              </div>
            </div>

            {/* Paper Badges Scroll Row */}
            <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto pr-1">
              {availablePapers.map((paper) => {
                const isSelected = selectedPaperIds.includes(paper.id);
                return (
                  <button
                    key={paper.id}
                    onClick={() => toggleSelectPaper(paper.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-violet-600 border-violet-400 text-white shadow-md shadow-violet-600/30"
                        : "bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-md flex items-center justify-center border ${
                      isSelected ? "bg-white text-violet-600 border-white" : "border-slate-600"
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span className="truncate max-w-[180px]">{paper.title}</span>
                    {paper.page_count && (
                      <span className="text-[9.5px] opacity-75 font-mono">({paper.page_count}p)</span>
                    )}
                  </button>
                );
              })}

              {availablePapers.length === 0 && uploadingFiles.length === 0 && (
                <p className="text-xs text-slate-500 italic">No papers uploaded yet. Click &quot;Upload PDF(s)&quot; or drag &amp; drop files above.</p>
              )}
            </div>

            {/* Upload Progress Notification Badges */}
            {uploadingFiles.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-2">
                {uploadingFiles.map((up) => (
                  <div
                    key={up.id}
                    className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                  >
                    {up.status === "uploading" ? (
                      <div className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    ) : up.status === "done" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                    <span className="truncate max-w-[140px] font-semibold">{up.file.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {up.status === "uploading" ? `${up.progress}%` : up.status === "done" ? "Ready" : "Error"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Central Chat Stream Container */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative flex flex-col items-center">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center my-auto space-y-6">
              {/* 3D Orb Animation */}
              <div className="container-vao">
                <div className="orb">
                  <div className="ball">
                    <div className="container-lines"></div>
                    <div className="container-rings"></div>
                  </div>
                  <svg style={{ pointerEvents: "none", position: "absolute" }}>
                    <filter id="gooey">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="6"></feGaussianBlur>
                      <feColorMatrix values="1 0 0 0 0 1 0 0 0 0 0 20 -10"></feColorMatrix>
                    </filter>
                  </svg>
                </div>
              </div>
              
              <div className="text-center space-y-1.5 z-10 max-w-md">
                <h2 className="text-xl font-bold text-white tracking-wide">How can I assist your cross-paper research?</h2>
                <p className="text-xs text-slate-400">
                  Upload multiple PDFs at once and ask questions across all papers simultaneously.
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl space-y-4 py-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-3xl p-5 shadow-xl ${
                    msg.role === "user" 
                      ? "bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white rounded-tr-sm" 
                      : "bg-slate-900/90 border border-slate-800 text-slate-200 backdrop-blur-xl rounded-tl-sm shadow-2xl"
                  }`}>
                    {/* User message targeted context badge */}
                    {msg.role === "user" && msg.targetedPapers && msg.targetedPapers.length > 0 && (
                      <div className="mb-2 pb-2 border-b border-white/20 flex items-center gap-1.5 text-[10px] text-white/90 font-bold">
                        <BookOpen className="w-3 h-3 text-white/90" />
                        <span>Query Context: {msg.targetedPapers.join(", ")}</span>
                      </div>
                    )}

                    {/* Assistant Message Content (Formatted Markdown) or User plain text */}
                    {msg.role === "assistant" ? (
                      <FormattedAssistantMessage content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed text-sm">{msg.content}</div>
                    )}
                    
                    {/* Assistant Grounded Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-slate-800">
                        <p className="text-[10.5px] font-extrabold text-violet-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#d946ef]" />
                          Grounded Multi-Paper Citations &amp; Evidence:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.citations.map((cit, idx) => (
                            <div key={idx} className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                              <div className="flex items-center justify-between text-[10.5px]">
                                <span className="text-violet-300 font-extrabold">[{idx+1}] {cit.section_type.toUpperCase()}</span>
                                {cit.page_number && (
                                  <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-mono text-[9px] font-bold">
                                    p. {cit.page_number}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-300 line-clamp-2 italic">
                                &quot;{cit.preview || cit.text}&quot;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Floating Input Bar & Multi-Paper Presets */}
        <div className="w-full max-w-4xl mx-auto space-y-2 pt-2 shrink-0">
          <div className="rounded-3xl border transition-all duration-300 border-white/20 bg-slate-900/80 backdrop-blur-xl hover:border-[#a855f7]/50 shadow-[0_8px_30px_rgba(168,85,247,0.25)] p-3">
            <div className="flex flex-col px-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={
                  selectedPaperIds.length > 0
                    ? `Ask a question across the ${selectedPaperIds.length} selected papers...`
                    : "Ask anything across all research papers..."
                }
                className="w-full bg-transparent border-0 outline-none text-white placeholder:text-white/40 text-sm sm:text-base resize-none"
                rows={1}
                style={{ maxHeight: "120px" }}
              />

              <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/10 mt-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    type="button" 
                    title="Upload Multiple PDFs"
                    className="flex h-8 px-2.5 text-xs font-bold text-violet-300 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 cursor-pointer items-center justify-center rounded-xl transition-all gap-1.5 shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add PDF(s)</span>
                  </button>

                  <div className="relative h-6 w-[1.5px] mx-1 bg-gradient-to-t from-transparent via-[#a855f7] to-transparent opacity-70" />

                  {/* Mode selector */}
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 outline-none cursor-pointer hover:border-violet-500"
                    title="Explanation Mode"
                  >
                    <option value="grad">Graduate / AI Engineer</option>
                    <option value="undergrad">Undergrad CS</option>
                    <option value="phd">PhD Theoretical Rigor</option>
                    <option value="eli5">ELI5 Simple Intuition</option>
                    <option value="code">Code &amp; Implementation</option>
                    <option value="interview">Senior Interview Summary</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleSend()}
                    disabled={streaming || !input.trim()}
                    className="size-9 rounded-full transition-all duration-200 bg-gradient-to-r from-[#a855f7] to-[#d946ef] hover:from-[#9333ea] hover:to-[#c026d3] text-white flex items-center justify-center disabled:opacity-40 shadow-lg cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Prompts Chips (Only visible on initial state or compact bottom) */}
          {messages.length === 0 && (
            <div className="space-y-1.5 pb-1">
              <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto px-4">
                {MULTI_PAPER_PRESETS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="text-xs rounded-full px-3.5 py-1 bg-slate-900/70 border border-white/15 text-slate-300 hover:bg-slate-800 hover:border-[#a855f7]/50 hover:text-white transition-all shadow-sm cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

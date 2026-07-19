"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  CloudArrowUpIcon, 
  DocumentTextIcon, 
  XMarkIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon 
} from "@heroicons/react/24/outline";
import AppShell from "../components/AppShell";

import { API_URL as API } from "../config";

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: "pending" | "uploading" | "done" | "error" | "duplicate";
  message?: string;
  paperId?: number;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API}/papers/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
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
      setFiles((prev) =>
        prev.map((f) =>
          f.id === entry.id
            ? {
                ...f,
                status: isDuplicate ? "duplicate" : "done",
                progress: 100,
                message: data.message,
                paperId: data.id,
              }
            : f
        )
      );
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

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8 font-sans">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Upload Research Papers</h1>
          <p className="mt-1 text-slate-400 text-xs">
            Drag & drop PDFs or browse files to automatically extract metadata and sections.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed
            cursor-pointer transition-all duration-300 py-16 px-8 bg-[#130F26] shadow-xl
            ${isDragging
              ? "border-[#8B5CF6] bg-[#8B5CF6]/10 scale-[1.01]"
              : "border-[#271F4D] hover:border-[#8B5CF6]/50 hover:bg-[#181335]"
            }
          `}
        >
          <div className={`p-4 rounded-2xl transition-all duration-300 ${isDragging ? "bg-[#8B5CF6]/20" : "bg-[#211A47] text-[#A855F7]"}`}>
            <CloudArrowUpIcon className="w-10 h-10" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-100 tracking-wide">
              {isDragging ? "Drop PDFs here" : "Drag & drop PDFs"}
            </p>
            <p className="text-xs text-slate-400 mt-1">or <span className="text-[#A855F7] font-bold underline">browse local files</span></p>
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

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-4 rounded-2xl bg-[#130F26] border border-[#271F4D] px-5 py-4 shadow-xl"
              >
                <div className="w-10 h-10 rounded-xl bg-[#281F54] text-[#A855F7] flex items-center justify-center shrink-0">
                  <DocumentTextIcon className="w-5 h-5" />
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

                {/* Status icon */}
                <div className="shrink-0 flex items-center gap-3">
                  {f.status === "done" && <CheckCircleIcon className="w-5 h-5 text-emerald-400" />}
                  {f.status === "duplicate" && <CheckCircleIcon className="w-5 h-5 text-amber-400" />}
                  {f.status === "error" && <ExclamationCircleIcon className="w-5 h-5 text-red-400" />}
                  {f.status === "uploading" && (
                    <div className="w-5 h-5 rounded-full border-2 border-[#8B5CF6] border-t-transparent animate-spin" />
                  )}
                  {f.status === "pending" && (
                    <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  )}

                  {f.paperId && (
                    <button
                      onClick={() => router.push(`/papers/${f.paperId}`)}
                      className="text-xs font-bold text-[#A855F7] hover:text-[#C026D3] transition-colors bg-[#251B4F] border border-[#3C2D7B] px-3 py-1 rounded-lg shrink-0 cursor-pointer shadow-sm ml-2"
                    >
                      View
                    </button>
                  )}
                </div>
              </div>
            ))}

            {pendingCount > 0 && (
              <button
                onClick={uploadAll}
                className="w-full mt-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] hover:from-[#7C3AED] hover:to-[#C026D3] transition-all duration-200 shadow-lg text-white flex items-center justify-center cursor-pointer"
              >
                Upload {pendingCount} Paper{pendingCount > 1 ? "s" : ""}
              </button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

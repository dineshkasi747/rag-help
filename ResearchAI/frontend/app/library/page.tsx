"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import Link from "next/link";
import { 
  DocumentTextIcon, 
  ArrowUpTrayIcon, 
  AcademicCapIcon, 
  ChevronRightIcon 
} from "@heroicons/react/24/outline";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface Paper {
  id: number;
  original_filename: string;
  status: string;
  uploaded_at: string;
  metadata: {
    title: string | null;
    authors: string[] | null;
    publication_year: number | null;
    journal_or_venue: string | null;
  };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    processing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

export default function LibraryPage() {
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
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Paper Library</h1>
            <p className="text-slate-400 text-xs mt-1">Manage and inspect your uploaded research documents</p>
          </div>
          <Link 
            href="/upload" 
            className="bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] hover:from-[#7C3AED] hover:to-[#C026D3] text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-purple-900/30 flex items-center gap-2 transition-all cursor-pointer"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            <span>Upload Paper</span>
          </Link>
        </div>

        {/* Library Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 rounded-3xl bg-[#130F26] border border-[#271F4D] animate-pulse" />
            ))}
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-[#271F4D] rounded-3xl bg-[#130F26]/60 backdrop-blur-md">
            <AcademicCapIcon className="w-14 h-14 text-slate-600 mx-auto mb-4" />
            <p className="text-white font-bold text-lg">Your library is empty</p>
            <p className="text-slate-400 text-xs mt-1 mb-6">Upload some research papers to start RAG query sessions.</p>
            <Link href="/upload" className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#D946EF] text-xs font-bold text-white transition-all shadow-md cursor-pointer">
              Upload PDF
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {papers.map(p => (
              <Link
                key={p.id}
                href={`/papers/${p.id}`}
                className="group flex flex-col bg-[#130F26] border border-[#271F4D] hover:border-[#8B5CF6]/50 rounded-3xl p-6 transition-all duration-300 shadow-xl cursor-pointer h-full min-h-[190px]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#281F54] text-[#A855F7] flex items-center justify-center group-hover:scale-105 transition-transform shadow-inner">
                    <DocumentTextIcon className="w-5 h-5" />
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                
                <h3 className="text-sm font-bold text-slate-100 line-clamp-2 mb-3 group-hover:text-white transition-colors leading-snug">
                  {p.metadata?.title || p.original_filename}
                </h3>
                
                <div className="mt-auto pt-3 border-t border-[#231B45]">
                  <p className="text-xs font-semibold text-slate-400 line-clamp-1">
                    {p.metadata?.authors?.join(", ") || "Unknown Authors"}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium truncate mt-1">
                    {p.metadata?.journal_or_venue || "Unknown Venue"} 
                    {p.metadata?.publication_year ? ` · ${p.metadata.publication_year}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

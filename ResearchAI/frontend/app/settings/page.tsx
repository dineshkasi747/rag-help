"use client";

import { useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { Settings, User, Key, Shield, Save, Check } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [llmProvider, setLlmProvider] = useState("groq");
  const [embeddingModel, setEmbeddingModel] = useState("gemini");

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8 font-satoshi py-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Settings & Configuration</h1>
          <p className="text-white/50 text-sm mt-1">Manage profile, AI model providers, and system keys</p>
        </div>

        <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* User Profile */}
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-[#a855f7] uppercase tracking-wider flex items-center gap-2">
                <User className="w-4 h-4" />
                Account Profile
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/70 font-semibold block mb-1">Full Name</label>
                  <input 
                    type="text" 
                    defaultValue={user?.full_name || "Research User"} 
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#a855f7]"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/70 font-semibold block mb-1">Email Address</label>
                  <input 
                    type="email" 
                    readOnly
                    defaultValue={user?.email || "user@example.com"} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white/60 outline-none cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-6 space-y-4">
              <h2 className="text-sm font-extrabold text-[#d946ef] uppercase tracking-wider flex items-center gap-2">
                <Key className="w-4 h-4" />
                AI Model Engine Configuration
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/70 font-semibold block mb-1">Active LLM Provider</label>
                  <select 
                    value={llmProvider}
                    onChange={e => setLlmProvider(e.target.value)}
                    className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#a855f7]"
                  >
                    <option value="groq">Groq (LLaMA 3.3 70B - Fast & Free)</option>
                    <option value="gemini">Google Gemini (Gemini 2.0 Flash)</option>
                    <option value="anthropic">Anthropic Claude 3.5</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-white/70 font-semibold block mb-1">Vector Embedding Provider</label>
                  <select 
                    value={embeddingModel}
                    onChange={e => setEmbeddingModel(e.target.value)}
                    className="w-full bg-slate-800 border border-white/20 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#a855f7]"
                  >
                    <option value="gemini">Google Gemini Embeddings (0 MB Disk)</option>
                    <option value="st">Local SentenceTransformers (all-MiniLM-L6-v2)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between border-t border-white/10">
              {saved ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Settings Saved Successfully
                </span>
              ) : <span />}

              <button 
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#d946ef] text-white text-xs font-bold shadow-lg hover:opacity-90 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

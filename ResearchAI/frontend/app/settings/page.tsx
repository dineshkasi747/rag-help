"use client";

import { useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Settings, User, Key, Shield, Save, Check, Sun, Moon, Palette } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Settings &amp; Configuration</h1>
          <p className="text-white/50 text-sm mt-1">Manage profile, interface appearance, AI model providers, and system keys</p>
        </div>

        <div className="bg-slate-900/70 border border-white/15 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-xl space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Theme Appearance Mode */}
            <div className="space-y-4">
              <h2 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Interface Appearance &amp; Theme
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`p-4 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer text-left ${
                    theme === "dark"
                      ? "bg-slate-950 border-[#a855f7] ring-2 ring-[#a855f7]/50 shadow-lg"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="p-3 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                    <Moon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Cosmic Dark Theme (Default)</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Deep violet dark universe with neon accents &amp; glow manifolds</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`p-4 rounded-2xl border transition-all flex items-center gap-3.5 cursor-pointer text-left ${
                    theme === "light"
                      ? "bg-white border-[#d946ef] ring-2 ring-[#d946ef]/50 shadow-lg text-slate-900"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="p-3 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Clean Light Theme</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Crisp, luminous high-contrast aesthetic tailored for daytime reading</p>
                  </div>
                </button>
              </div>
            </div>

            {/* User Profile */}
            <div className="border-t border-white/10 pt-6 space-y-4">
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

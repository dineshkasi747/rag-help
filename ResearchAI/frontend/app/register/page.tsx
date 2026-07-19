"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";
import { User, Mail, Lock, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      await register(email, password, fullName);
    } catch (err: any) {
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center p-4 bg-[#090713] overflow-hidden font-satoshi">
      {/* Background image & gradient overlay */}
      <div className="absolute inset-0 w-full h-full">
        <img 
          src="/assets/auth-bg-img-CDIj7Qyi.jpg" 
          alt="Background" 
          className="w-full h-full object-cover opacity-60" 
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090713] via-[#090713]/80 to-transparent" />
      </div>

      <div className="w-full max-w-md relative z-10 my-auto">
        <div data-slot="card" className="text-white flex flex-col gap-5 rounded-2xl md:rounded-3xl border border-white/15 p-6 sm:p-8 shadow-2xl backdrop-blur-xl bg-slate-900/70">
          <div data-slot="card-header" className="space-y-1.5 text-center">
            <div className="flex justify-center mb-2">
              <img src="/assets/Okyai-logo-B4yM7Mtr.png" alt="OkyAI Logo" className="h-12 w-auto" />
            </div>
            <h1 data-slot="card-title" className="text-2xl font-extrabold text-white tracking-tight">Create Account</h1>
            <p data-slot="card-description" className="text-white/50 text-xs sm:text-sm">Start transforming research papers into insight</p>
          </div>

          <div data-slot="card-content">
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="register-name" className="text-xs font-semibold text-white/80 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    id="register-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="h-10 w-full rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#7a4aff] focus:bg-white/15 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="register-email" className="text-xs font-semibold text-white/80 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    id="register-email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-10 w-full rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#7a4aff] focus:bg-white/15 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="register-password" className="text-xs font-semibold text-white/80 uppercase tracking-wider">Password <span className="text-white/40 font-normal normal-case">(min 8 chars)</span></label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    id="register-password"
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 w-full rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#7a4aff] focus:bg-white/15 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-[#7a4aff] to-[#4c1d95] hover:from-[#6b38ef] hover:to-[#3b1277] text-white font-bold text-sm shadow-lg shadow-purple-900/40 transition-all cursor-pointer disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>

              <div className="text-center text-xs text-white/60 pt-3 border-t border-white/10">
                Already have an account?{" "}
                <Link href="/login" className="text-[#9b6eff] hover:underline font-bold">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

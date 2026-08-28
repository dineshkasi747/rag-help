"use client";

import { Search, Bell, CircleUser, PanelLeft, Sun, Moon } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function TopHeader() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";

  return (
    <header className={`sticky top-0 z-50 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 backdrop-blur-md mx-2 sm:mx-4 md:mx-10 rounded-b-2xl px-3 sm:px-6 transition-all duration-300 ${
      isDark
        ? "bg-gradient-to-r from-[#a855f7] via-[#9333ea] to-[#d946ef] text-white shadow-xl"
        : "bg-white/95 border-b border-x border-slate-200/90 text-slate-800 shadow-sm"
    }`}>
      {/* SVG Curved Corners in Dark Mode */}
      {isDark && (
        <div className="absolute w-full h-full rounded-l-2xl top-0 left-0 pointer-events-none">
          <svg className="absolute left-[-30px] top-0 svg-corner rotate-90" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_310_2)"><path d="M30 0H0V30C0 13.431 13.431 0 30 0Z"></path></g>
            <defs><clipPath id="clip0_310_2"><rect width="30" height="30" fill="white"></rect></clipPath></defs>
          </svg>
          <svg className="absolute right-[-30px] top-0 svg-corner svg-pink" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g clipPath="url(#clip0_310_3)"><path d="M30 0H0V30C0 13.431 13.431 0 30 0Z"></path></g>
            <defs><clipPath id="clip0_310_3"><rect width="30" height="30" fill="white"></rect></clipPath></defs>
          </svg>
        </div>
      )}

      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Panel Toggle */}
        <button 
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 size-8 xl:hidden cursor-pointer ${
            isDark ? "text-white/90 hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
          }`}
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="size-5" />
        </button>

        {/* Desktop Search Input */}
        <div className="relative w-full max-w-md hidden md:block">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 size-4 ${
            isDark ? "text-white/70" : "text-slate-400"
          }`} />
          <input 
            className={`w-full min-w-0 rounded-xl px-3 py-1 pl-9 h-9 text-sm transition-colors outline-none ${
              isDark
                ? "border-0 bg-white/20 text-white placeholder:text-white/60 shadow-xs focus:bg-white/30"
                : "border border-slate-200 bg-slate-100 text-slate-900 placeholder:text-slate-500 focus:bg-white focus:border-violet-500 shadow-inner"
            }`}
            placeholder="Search research papers, topics, formulas..." 
            type="search"
          />
        </div>
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle Button (Dark / Light Mode) */}
        <button
          onClick={toggleTheme}
          className={`inline-flex items-center justify-center rounded-xl size-9 p-2 transition-all duration-300 hover:scale-105 cursor-pointer shadow-sm ${
            isDark
              ? "bg-white/15 hover:bg-white/25 text-white border border-white/20"
              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
          }`}
          title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
          aria-label="Toggle Theme"
        >
          {isDark ? (
            <Sun className="size-4.5 text-amber-300 transition-transform rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="size-4.5 text-violet-600 transition-transform rotate-0 hover:-rotate-12" />
          )}
        </button>

        {/* Mobile Search Button */}
        <button className={`inline-flex items-center justify-center rounded-lg size-9 md:hidden cursor-pointer ${
          isDark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
        }`}>
          <Search className="size-5" />
        </button>

        {/* Notifications Bell Button */}
        <button 
          className={`inline-flex items-center justify-center rounded-lg size-9 relative group cursor-pointer transition-transform hover:scale-105 ${
            isDark ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100"
          }`}
          title="Notifications"
        >
          <Bell className="size-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12" />
          <span className="absolute top-1.5 right-1.5 size-2 bg-pink-500 rounded-full animate-pulse"></span>
        </button>

        {/* User Profile Avatar */}
        <button className="flex items-center gap-2 rounded-full group cursor-pointer p-0.5">
          <div className={`flex items-center justify-center size-8 rounded-full border transition-all duration-300 group-hover:shadow-md ${
            isDark ? "bg-white/20 border-white/30 text-white" : "bg-violet-100 border-violet-200 text-violet-700"
          }`}>
            <CircleUser className="size-5" />
          </div>
          {(user?.full_name || user?.email) && (
            <span className={`hidden sm:inline text-xs font-bold tracking-wide pr-1 ${
              isDark ? "text-white" : "text-slate-700"
            }`}>
              {user.full_name || user.email}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

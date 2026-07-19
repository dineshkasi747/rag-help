"use client";

import { Search, Bell, CircleUser, PanelLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function TopHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 bg-gradient-to-r from-[#a855f7] via-[#9333ea] to-[#d946ef] backdrop-blur-md mx-5 md:mx-10 rounded-b-2xl px-4 md:px-6 shadow-xl">
      {/* SVG Curved Corners */}
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

      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Panel Toggle */}
        <button 
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-300 text-white/90 hover:bg-white/10 size-8 xl:hidden cursor-pointer"
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="size-5" />
        </button>

        {/* Desktop Search Input */}
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/70" />
          <input 
            className="w-full min-w-0 rounded-md border-0 bg-white/20 px-3 py-1 pl-9 h-9 text-sm text-white placeholder:text-white/60 shadow-xs transition-colors outline-none focus:bg-white/30" 
            placeholder="Search..." 
            type="search"
          />
        </div>
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-2">
        {/* Mobile Search Button */}
        <button className="inline-flex items-center justify-center rounded-lg text-white hover:bg-white/10 size-9 md:hidden cursor-pointer">
          <Search className="size-5" />
        </button>

        {/* Notifications Bell Button */}
        <button 
          className="inline-flex items-center justify-center rounded-lg text-white hover:bg-white/10 size-9 relative group cursor-pointer transition-transform hover:scale-105"
          title="Notifications"
        >
          <Bell className="size-5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12" />
          <span className="absolute top-1.5 right-1.5 size-2 bg-pink-400 rounded-full animate-pulse"></span>
        </button>

        {/* User Profile Avatar */}
        <button className="flex items-center gap-2 rounded-full group cursor-pointer p-0.5">
          <div className="flex items-center justify-center size-8 rounded-full bg-white/20 border border-white/30 transition-all duration-300 group-hover:shadow-lg">
            <CircleUser className="size-5 text-white" />
          </div>
          {(user?.full_name || user?.email) && (
            <span className="hidden sm:inline text-xs font-bold text-white tracking-wide pr-1">
              {user.full_name || user.email}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}

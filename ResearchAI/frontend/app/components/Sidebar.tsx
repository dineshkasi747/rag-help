"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Wand2, 
  Bot, 
  Activity, 
  CreditCard, 
  Settings as SettingsIcon,
  Gem,
  LogOut,
  UploadCloud,
  GraduationCap
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Paper", icon: UploadCloud },
  { href: "/chat", label: "AI Chatbot", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/quiz", label: "Quiz Generator", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <aside 
      data-slot="sidebar-container" 
      className="fixed inset-y-0 z-50 flex w-24 flex-col justify-between items-center transition-all duration-200 left-0 bg-transparent select-none"
      style={{ "--sidebar-width": "6rem" } as React.CSSProperties}
    >
      <div data-sidebar="sidebar" data-slot="sidebar-inner" className="flex min-h-screen justify-between items-center w-full flex-col py-3">
        {/* Sidebar Header Logo */}
        <div data-slot="sidebar-header" data-sidebar="header" className="flex flex-col gap-2 p-2">
          <Link href="/dashboard" className="flex items-center justify-center cursor-pointer group">
            <img 
              width="60" 
              src="/assets/Okyai-logo-B4yM7Mtr.png" 
              alt="OkyAI Logo" 
              className="group-hover:scale-105 transition-transform"
            />
          </Link>
        </div>

        {/* Sidebar Content / Main Rail */}
        <div data-slot="sidebar-content" data-sidebar="content" className="flex flex-col gap-2 w-full">
          <div data-slot="sidebar-group" data-sidebar="group" className="relative flex w-full min-w-0 flex-col">
            <div data-slot="sidebar-group-content" data-sidebar="group-content" className="w-full text-sm relative">
              <ul 
                data-slot="sidebar-menu" 
                data-sidebar="menu" 
                className="flex justify-center relative items-center bg-gradient-to-b from-[#a855f7] via-[#9333ea] to-[#d946ef] h-full rounded-r-3xl w-full min-w-0 flex-col gap-3.5 p-3 py-6 shadow-xl"
              >
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                  return (
                    <li key={href} data-slot="sidebar-menu-item" data-sidebar="menu-item" className="group/menu-item relative">
                      <Link
                        href={href}
                        title={label}
                        data-slot="sidebar-menu-button"
                        data-sidebar="menu-button"
                        data-active={active ? "true" : "false"}
                        className={`
                          peer/menu-button flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl p-3 text-left transition-all duration-200 cursor-pointer
                          ${active
                            ? "bg-white/20 text-white font-medium border border-white/30 shadow-lg scale-105"
                            : "text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 border border-transparent hover:scale-105"
                          }
                        `}
                      >
                        <Icon className="w-5 h-5 shrink-0 text-white" />
                      </Link>
                    </li>
                  );
                })}

                <li data-slot="sidebar-menu-item" className="group/menu-item relative pt-2 border-t border-white/20">
                  <button
                    onClick={logout}
                    title="Sign Out"
                    className="flex w-full items-center justify-center p-3 rounded-xl text-white/70 hover:text-red-200 hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <LogOut className="w-5 h-5 shrink-0" />
                  </button>
                </li>
              </ul>

              {/* SVG Curved Corner Accents from Template */}
              <div className="absolute hidden xl:block w-full h-full top-0 left-0 pointer-events-none">
                <svg className="absolute left-0 bottom-[-30px] svg-corner svg-pink" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_310_2)"><path d="M30 0H0V30C0 13.431 13.431 0 30 0Z"></path></g>
                  <defs><clipPath id="clip0_310_2"><rect width="30" height="30" fill="white"></rect></clipPath></defs>
                </svg>
                <svg className="absolute left-0 top-[-30px] -rotate-90 svg-corner" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_310_3)"><path d="M30 0H0V30C0 13.431 13.431 0 30 0Z"></path></g>
                  <defs><clipPath id="clip0_310_3"><rect width="30" height="30" fill="white"></rect></clipPath></defs>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer Gem Badge */}
        <div data-slot="sidebar-footer" data-sidebar="footer" className="flex flex-col gap-2 p-2">
          <div className="px-2">
            <button 
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-300 size-10 rounded-full hover:bg-white/10 hover:scale-110 cursor-pointer" 
              type="button"
              title="Pro VIP"
            >
              <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-tr from-[#a855f7] to-[#d946ef] shadow-lg border border-white/20">
                <Gem className="size-5 text-white" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

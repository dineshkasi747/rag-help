"use client";

import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { useRouter } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import HandsLoader from "./HandsLoader";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [handsDone, setHandsDone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("hands_played") === "true") {
      setHandsDone(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading]);

  if (loading || !handsDone) {
    return (
      <HandsLoader 
        onComplete={() => {
          sessionStorage.setItem("hands_played", "true");
          setHandsDone(true);
        }} 
      />
    );
  }

  if (!user) return null;

  return (
    <div 
      data-slot="sidebar-wrapper" 
      className="group/sidebar-wrapper flex min-h-screen w-full relative overflow-x-hidden font-satoshi bg-cover bg-fixed bg-center"
      style={{ backgroundImage: "url('/assets/saas-bg-BWWvkdaI.png')" }}
    >
      {/* Sidebar Rail */}
      <Sidebar />

      {/* Main Container Inset */}
      <div data-slot="sidebar-inset" className="relative flex w-full flex-1 flex-col pl-0 xl:pl-24 z-10 min-h-screen">
        <TopHeader />
        
        <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

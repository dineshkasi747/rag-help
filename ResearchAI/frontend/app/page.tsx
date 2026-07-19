"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      {/* Short spinner while redirecting to the AppShell */}
      <div className="w-8 h-8 border-2 border-[#7a4aff] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export default function HandsLoader({ onComplete }: { onComplete: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // The slide-in animation takes 1.5s.
    // Wait 1.9s total (1.5s slide-in + 0.4s pause) before starting fade out
    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1900);

    // Fade animation takes 0.5s. Call onComplete after 2.4s total.
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2400);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-50 h-screen w-screen bg-[#06060c] overflow-hidden flex items-center justify-center ${fading ? "animate-fade-out" : ""}`}>
      {/* Top right hand */}
      <div className="absolute top-0 right-0 w-1/2 z-30 translate-x-full animate-slide-top-right">
        <img src="/hand-top.png" alt="" className="w-full h-auto object-contain" />
      </div>

      {/* Bottom left hand */}
      <div className="absolute bottom-0 left-0 w-1/2 z-30 -translate-x-full animate-slide-bottom-left">
        <img src="/hand-bottom.png" alt="" className="w-full h-auto object-contain" />
      </div>
    </div>
  );
}

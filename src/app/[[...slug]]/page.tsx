"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const App = dynamic(() => import("@/App"), { ssr: false });

export default function SpaCatchAllPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#06080D] text-[#F2F4F8]">
          Chargement…
        </div>
      }
    >
      <App />
    </Suspense>
  );
}

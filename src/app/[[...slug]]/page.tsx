"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { PageLoadingFallback } from "@/components/PageLoadingFallback";

const App = dynamic(() => import("@/App"), { ssr: false });

export default function SpaCatchAllPage() {
  return (
    <Suspense fallback={<PageLoadingFallback fullScreen />}>
      <App />
    </Suspense>
  );
}

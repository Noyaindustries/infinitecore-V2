"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const App = dynamic(() => import("@/App"), { ssr: false });

export default function SpaCatchAllPage() {
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}

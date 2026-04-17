"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import AppLoadingSplash from "@/components/AppLoadingSplash";

const App = dynamic(() => import("@/App"), { ssr: false });

export default function SpaCatchAllPage() {
  return (
    <Suspense fallback={<AppLoadingSplash />}>
      <App />
    </Suspense>
  );
}

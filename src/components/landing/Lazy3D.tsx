"use client";

// WebGL scenes are client-only and heavy: load them lazily so the page paints instantly.
import dynamic from "next/dynamic";

export const LazyHero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  loading: () => <div className="h-full w-full" aria-hidden />,
});

export const LazyFundingFlow3D = dynamic(() => import("./FundingFlow3D"), {
  ssr: false,
  loading: () => <div className="h-full w-full" aria-hidden />,
});

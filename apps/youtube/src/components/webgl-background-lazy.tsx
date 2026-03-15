"use client";

import dynamic from "next/dynamic";

const WebGLBackgroundInner = dynamic(
  () => import("./webgl-background").then((m) => ({ default: m.WebGLBackground })),
  { ssr: false }
);

export function LazyWebGLBackground() {
  return <WebGLBackgroundInner />;
}

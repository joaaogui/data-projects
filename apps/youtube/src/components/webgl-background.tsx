"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2 uMouse;
  uniform vec2 uResolution;
  uniform float uDark;

  varying vec2 vUv;

  mat2 rot(float x) {
    float c = cos(x), s = sin(x);
    return mat2(c, -s, s, c);
  }

  float height(vec2 p, float t) {
    return sin(p.x * 0.8) + sin(p.x * 0.6 + p.y * 0.7) + cos(p.y * 0.9) / 1.5 + sin(t + p.x * 0.5) + 5.0;
  }

  float map(vec3 p, float t) {
    return p.y - height(p.xz, t);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
    float t = uTime * 0.4;

    vec3 ray = normalize(vec3(uv, 1.0));
    ray.yz *= rot(sin(t * 0.25) / 3.0 + 1.5);
    ray.xz *= rot((sin(t * 0.2) / 2.0 + 1.0) / 5.0);

    // Mouse influence on camera
    ray.xz *= rot(uMouse.x * 0.15);
    ray.yz *= rot(uMouse.y * 0.08);

    float d = 0.0;
    for (int i = 0; i < 40; i++) {
      d += map(vec3(t, 0.0, t * 0.5) + ray * d, t) * 0.5;
    }

    float fog = 1.0 / (1.0 + d * d * 0.004);

    // Dark theme: deep red/magenta tones
    vec3 darkColor = vec3(fog * fog, fog * 0.35, fog * 0.55);
    darkColor *= vec3(1.0, 0.6, 0.8);

    // Light theme: visible cool-lavender terrain against a clean base
    vec3 lightColor = mix(
      vec3(0.95, 0.93, 0.97),
      vec3(0.84, 0.80, 0.90),
      fog * fog
    );

    vec3 color = mix(lightColor, darkColor, uDark);

    // Vignette
    vec2 vigUv = vUv - 0.5;
    float vig = 1.0 - dot(vigUv, vigUv) * 1.2;
    color *= mix(0.85, 1.0, vig);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function ShaderPlane({ mouse }: Readonly<{ mouse: React.RefObject<{ x: number; y: number } | null> }>) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uDark: { value: 1 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const smoothMouse = useRef(new THREE.Vector2(0, 0));

  useFrame(({ clock }) => {
    const mat = meshRef.current?.material as THREE.ShaderMaterial | undefined;
    if (!mat) return;

    const u = mat.uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uResolution.value.set(size.width, size.height);

    const target = mouse.current ?? { x: 0, y: 0 };
    smoothMouse.current.x += (target.x - smoothMouse.current.x) * 0.04;
    smoothMouse.current.y += (target.y - smoothMouse.current.y) * 0.04;
    u.uMouse.value.copy(smoothMouse.current);

    const isDark = document.documentElement.classList.contains("dark") ? 1 : 0;
    u.uDark.value += (isDark - u.uDark.value) * 0.05;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        depthWrite={false}
        depthTest={false}
      />
    </mesh>
  );
}

export function WebGLBackground() {
  const [mounted, setMounted] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);

    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5);
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (!mounted || prefersReducedMotion) return null;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 1] }}
      >
        <ShaderPlane mouse={mouse} />
      </Canvas>
    </div>
  );
}

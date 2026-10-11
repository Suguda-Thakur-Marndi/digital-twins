"use client";

import React, { useRef, useMemo, useCallback, useState } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RiskTier, RISK_COLORS } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";

// ── Types ─────────────────────────────────────────────────────────────────────
interface VitalNode {
  id: string;
  label: string;
  value: string | null;
  angle: number; // radians around center
  radius: number;
  height: number;
  color: string;
}

// ── Core glow sphere ─────────────────────────────────────────────────────────
function CoreSphere({ riskTier, riskColor, isDark }: { riskTier: RiskTier | null; riskColor: string; isDark: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const speed = riskTier === "HIGH" ? 2.0 : riskTier === "MEDIUM" ? 1.0 : 0.4;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (isDark ? 0.45 : 0.3) + Math.sin(t * speed) * 0.25;
      meshRef.current.rotation.y = t * 0.2;
      meshRef.current.rotation.x = Math.sin(t * 0.15) * 0.05;
    }
    if (glowRef.current) {
      const s = 1 + Math.sin(t * speed * 0.7) * 0.04;
      glowRef.current.scale.setScalar(s);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (isDark ? 0.08 : 0.05) + Math.sin(t * speed) * 0.03;
    }
  });

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: riskColor,
        emissive: new THREE.Color(riskColor),
        emissiveIntensity: isDark ? 0.55 : 0.35,
        roughness: 0.25,
        metalness: isDark ? 0.6 : 0.4,
        transparent: true,
        opacity: 0.92,
      }),
    [riskColor, isDark]
  );

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: riskColor,
        transparent: true,
        opacity: isDark ? 0.1 : 0.06,
        side: THREE.BackSide,
      }),
    [riskColor, isDark]
  );

  return (
    <group>
      {/* Main core */}
      <mesh ref={meshRef} material={mat}>
        <icosahedronGeometry args={[0.28, 3]} />
      </mesh>
      {/* Outer glow */}
      <mesh ref={glowRef} material={glowMat}>
        <sphereGeometry args={[0.52, 24, 24]} />
      </mesh>
    </group>
  );
}

// ── Animated connection line ─────────────────────────────────────────────────
function ConnectionLine({
  start,
  end,
  color,
  opacity = 0.25,
  speed = 1.0,
}: {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity?: number;
  speed?: number;
}) {
  const lineRef = useRef<THREE.Line>(null);

  const points = useMemo(() => [start, end], [start, end]);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [points]);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      mat.opacity = opacity * (0.5 + 0.5 * Math.sin(clock.getElapsedTime() * speed + Math.random() * Math.PI));
    }
  });

  return (
    <primitive
      object={
        new THREE.Line(
          geometry,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity })
        )
      }
      ref={lineRef}
    />
  );
}

// ── Data node sphere (vital sign) ────────────────────────────────────────────
function DataNode({
  node,
  riskTier,
  active,
  isDark,
  onHover,
  onLeave,
  onClick,
}: {
  node: VitalNode;
  riskTier: RiskTier | null;
  active: boolean;
  isDark: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const speed = riskTier === "HIGH" ? 0.6 : riskTier === "MEDIUM" ? 0.35 : 0.18;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    // Orbit around center
    const theta = node.angle + t * speed * 0.25;
    meshRef.current.position.x = Math.cos(theta) * node.radius;
    meshRef.current.position.z = Math.sin(theta) * node.radius;
    meshRef.current.position.y = node.height + Math.sin(t * speed + node.angle) * 0.06;
    // Pulse scale
    const s = active ? 1.4 : 1 + Math.sin(t * speed * 2 + node.angle) * 0.08;
    meshRef.current.scale.setScalar(s);
  });

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: new THREE.Color(node.color),
        emissiveIntensity: active ? 0.95 : isDark ? 0.45 : 0.3,
        roughness: 0.25,
        metalness: isDark ? 0.6 : 0.3,
        transparent: true,
        opacity: active ? 1 : 0.88,
      }),
    [node.color, active, isDark]
  );

  return (
    <mesh
      ref={meshRef}
      material={mat}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover();
      }}
      onPointerOut={onLeave}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <sphereGeometry args={[active ? 0.11 : 0.085, 20, 20]} />
    </mesh>
  );
}

// ── Orbital ring ────────────────────────────────────────────────────────────
function OrbitalRing({
  radius,
  color,
  tilt = 0,
  speed = 0.1,
  opacity = 0.12,
}: {
  radius: number;
  color: string;
  tilt?: number;
  speed?: number;
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.z = clock.getElapsedTime() * speed;
  });
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }),
    [color, opacity]
  );
  return (
    <mesh ref={ref} rotation={[Math.PI / 2 + tilt, 0, 0]} material={mat}>
      <torusGeometry args={[radius, 0.007, 4, 80]} />
    </mesh>
  );
}

// ── Floating data particles ──────────────────────────────────────────────────
function DataParticles({ riskTier, riskColor, isDark }: { riskTier: RiskTier | null; riskColor: string; isDark: boolean }) {
  const count = 75;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 0.6 + Math.random() * 1.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);

  const speeds = useMemo(() => Array.from({ length: count }, () => Math.random() * 0.5 + 0.2), []);

  const pointsRef = useRef<THREE.Points>(null);
  const speed = riskTier === "HIGH" ? 1.5 : riskTier === "MEDIUM" ? 0.8 : 0.4;

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      const s = speeds[i];
      posAttr.setY(i, positions[i * 3 + 1] + Math.sin(t * speed * s + i) * 0.03);
    }
    posAttr.needsUpdate = true;
    pointsRef.current.rotation.y = t * 0.04;
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return g;
  }, [positions]);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: riskColor,
        size: isDark ? 0.022 : 0.016,
        transparent: true,
        opacity: isDark ? 0.55 : 0.35,
      }),
    [riskColor, isDark]
  );

  return <points ref={pointsRef} geometry={geo} material={mat} />;
}

// ── Default fallback nodes ───────────────────────────────────────────────────
const DEMO_NODES: VitalNode[] = [
  { id: "sbp", label: "SBP", value: null, angle: 0, radius: 1.1, height: 0.3, color: "#06b6d4" },
  { id: "dbp", label: "DBP", value: null, angle: (2 * Math.PI) / 5, radius: 1.0, height: 0.0, color: "#8b5cf6" },
  { id: "bmi", label: "BMI", value: null, angle: (4 * Math.PI) / 5, radius: 1.1, height: 0.2, color: "#f59e0b" },
  { id: "hr", label: "HR", value: null, angle: (6 * Math.PI) / 5, radius: 0.95, height: -0.1, color: "#ef4444" },
  { id: "weight", label: "WEIGHT", value: null, angle: (8 * Math.PI) / 5, radius: 1.05, height: 0.1, color: "#22c55e" },
  { id: "risk", label: "RISK", value: null, angle: Math.PI / 5, radius: 0.85, height: 0.4, color: "#94a3b8" },
];

// ── Scene ─────────────────────────────────────────────────────────────────────
function Scene({
  riskTier,
  riskColor,
  nodes,
  isDark,
  onActiveNodeChange,
}: {
  riskTier: RiskTier | null;
  riskColor: string;
  nodes: VitalNode[];
  isDark: boolean;
  onActiveNodeChange: (node: VitalNode | null) => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeId = hoveredId ?? selectedId;

  const handleHover = useCallback(
    (node: VitalNode) => {
      setHoveredId(node.id);
      onActiveNodeChange(node);
    },
    [onActiveNodeChange]
  );

  const handleLeave = useCallback(() => {
    setHoveredId(null);
    onActiveNodeChange(selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null);
  }, [selectedId, nodes, onActiveNodeChange]);

  const handleClick = useCallback(
    (node: VitalNode) => {
      setSelectedId((prev) => {
        const next = prev === node.id ? null : node.id;
        onActiveNodeChange(next ? node : null);
        return next;
      });
    },
    [onActiveNodeChange]
  );

  return (
    <>
      {/* Dynamic Theme Lighting */}
      <ambientLight intensity={isDark ? 0.45 : 0.7} />
      <pointLight position={[2, 3, 2]} intensity={isDark ? 1.4 : 1.1} color={isDark ? "#93c5fd" : "#2563eb"} />
      <pointLight position={[-2, -1, -2]} intensity={0.6} color={riskColor} />
      <pointLight position={[0, 2, 0]} intensity={isDark ? 0.4 : 0.25} color="#22d3ee" />

      {/* Grid helper with theme-aware styling */}
      <gridHelper
        args={[8, 20, isDark ? "#1e293b" : "#cbd5e1", isDark ? "#0f172a" : "#e2e8f0"]}
        position={[0, -1.0, 0]}
      />

      {/* Core */}
      <CoreSphere riskTier={riskTier} riskColor={riskColor} isDark={isDark} />

      {/* Orbital rings */}
      <OrbitalRing radius={0.75} color={riskColor} tilt={0.2} speed={0.08} opacity={isDark ? 0.16 : 0.1} />
      <OrbitalRing radius={1.15} color={isDark ? "#38bdf8" : "#0284c7"} tilt={-0.1} speed={-0.05} opacity={isDark ? 0.12 : 0.08} />
      <OrbitalRing radius={1.55} color={isDark ? "#818cf8" : "#4f46e5"} tilt={0.4} speed={0.03} opacity={isDark ? 0.1 : 0.06} />

      {/* Vital data nodes */}
      {nodes.map((node) => (
        <DataNode
          key={node.id}
          node={node}
          riskTier={riskTier}
          active={activeId === node.id}
          isDark={isDark}
          onHover={() => handleHover(node)}
          onLeave={handleLeave}
          onClick={() => handleClick(node)}
        />
      ))}

      {/* Floating particles */}
      <DataParticles riskTier={riskTier} riskColor={riskColor} isDark={isDark} />

      {/* Orbit controls */}
      <OrbitControls
        enablePan={false}
        minDistance={2.0}
        maxDistance={6.0}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={(2 * Math.PI) / 3}
        autoRotate
        autoRotateSpeed={riskTier === "HIGH" ? 1.5 : riskTier === "MEDIUM" ? 0.8 : 0.4}
        makeDefault
      />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────
export interface DigitalTwinVizProps {
  riskTier: RiskTier | null;
  loading?: boolean;
  error?: string | null;
  sbp?: number | null;
  dbp?: number | null;
  bmi?: number | null;
  hr?: number | null;
  weight?: number | null;
  riskScore?: number | null;
  patientName?: string;
  height?: string;
  className?: string;
}

export default function DigitalTwinViz({
  riskTier,
  loading,
  error,
  sbp,
  dbp,
  bmi,
  hr,
  weight,
  riskScore,
  patientName,
  height,
  className = "",
}: DigitalTwinVizProps) {
  const [activeNode, setActiveNode] = useState<VitalNode | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const riskColor =
    riskTier === "HIGH"
      ? RISK_COLORS.HIGH
      : riskTier === "MEDIUM"
      ? RISK_COLORS.MEDIUM
      : riskTier === "LOW"
      ? RISK_COLORS.LOW
      : isDark
      ? "#60A5FA"
      : "#2563EB";

  // Build vital nodes from real data if available
  const nodes = useMemo<VitalNode[]>(() => {
    const hasData = sbp != null || dbp != null;
    if (!hasData) return DEMO_NODES;
    return [
      { id: "sbp", label: "SBP", value: sbp != null ? `${Math.round(sbp)} mmHg` : null, angle: 0, radius: 1.1, height: 0.3, color: "#06b6d4" },
      { id: "dbp", label: "DBP", value: dbp != null ? `${Math.round(dbp)} mmHg` : null, angle: (2 * Math.PI) / 5, radius: 1.0, height: 0.0, color: "#8b5cf6" },
      { id: "bmi", label: "BMI", value: bmi != null ? bmi.toFixed(1) : null, angle: (4 * Math.PI) / 5, radius: 1.1, height: 0.2, color: "#f59e0b" },
      { id: "hr", label: "HR", value: hr != null ? `${Math.round(hr)} bpm` : null, angle: (6 * Math.PI) / 5, radius: 0.95, height: -0.1, color: "#ef4444" },
      { id: "weight", label: "WEIGHT", value: weight != null ? `${weight.toFixed(1)} kg` : null, angle: (8 * Math.PI) / 5, radius: 1.05, height: 0.1, color: "#22c55e" },
      {
        id: "risk",
        label: "RISK",
        value: riskScore != null ? `${(riskScore * 100).toFixed(1)}%` : (riskTier ?? null),
        angle: Math.PI / 5,
        radius: 0.85,
        height: 0.4,
        color: riskColor,
      },
    ];
  }, [sbp, dbp, bmi, hr, weight, riskScore, riskTier, riskColor]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[300px] gap-3 ${className}`}>
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--color-primary)]/20 animate-pulse" />
          <div className="absolute inset-2 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
          <div className="absolute inset-4 rounded-full bg-[var(--color-primary)]/10 animate-pulse" />
        </div>
        <p className="text-xs text-[var(--text-muted)] font-mono">Initializing Three.js Digital Twin…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full min-h-[300px] text-center px-6 ${className}`}>
        <div>
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <span className="text-red-400 text-base font-bold">!</span>
          </div>
          <p className="text-xs font-semibold text-red-400">Digital Twin service unavailable.</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Verify FastAPI is running on port 8000.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[320px] select-none ${className}`}>
      {/* Risk signal badge */}
      {riskTier && (
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full border shadow-2xs backdrop-blur-md"
            style={{
              color: riskColor,
              borderColor: `${riskColor}50`,
              background: `${riskColor}15`,
            }}
          >
            {riskTier} · 365d Complication Signal
          </span>
        </div>
      )}

      {/* Active Node HUD Pill */}
      {activeNode && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-4 py-1.5 rounded-full glass-modal border border-[var(--glass-border)] shadow-xl flex items-center gap-2.5 transition-all duration-150">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: activeNode.color }} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{activeNode.label}</span>
          <span className="text-xs font-mono font-bold text-[var(--text-primary)]">{activeNode.value ?? "—"}</span>
        </div>
      )}

      {/* Orbit Navigation Hint */}
      <div className="absolute top-3 right-3 z-10 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-lg border border-[var(--glass-border)] backdrop-blur-md">
        Drag to orbit · hover nodes
      </div>

      <Canvas
        camera={{ position: [0, 1.2, 3.8], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Scene
          riskTier={riskTier}
          riskColor={riskColor}
          nodes={nodes}
          isDark={isDark}
          onActiveNodeChange={setActiveNode}
        />
      </Canvas>

      {/* Scientific disclaimer */}
      <p className="absolute bottom-2 inset-x-0 text-center text-[10px] font-mono text-[var(--text-muted)] pointer-events-none">
        Abstract physiological lattice model · Not anatomical imaging
      </p>
    </div>
  );
}

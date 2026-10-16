"use client";

import React, {
  useRef,
  useState,
  useMemo,
  useEffect,
  useCallback,
  Suspense,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { RiskTier, RISK_COLORS, normalizeTier } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import {
  BODY_REGIONS,
  BodyRegionConfig,
  getRiskShapeCue,
  evaluateVitalStatus,
} from "@/lib/bodyMap";
import DigitalTwinViz from "./DigitalTwinViz";
import {
  Heart,
  Activity,
  Scale,
  User,
  Info,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Table as TableIcon,
  Shield,
  Eye,
} from "lucide-react";

import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// Preload the authentic Ready Player Me 3D human models
useGLTF.preload("/models/human-male.glb");
useGLTF.preload("/models/human-female.glb");

// ── WebGL Detection ───────────────────────────────────────────────────────────
function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

// ── SVG Micro-Sparkline ────────────────────────────────────────────────────────
function MicroSparkline({
  data,
  color,
  width = 90,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[9px] font-mono text-[var(--text-muted)] italic"
        style={{ width, height }}
      >
        Single telemetry point
      </div>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * (width - 4) + 2;
      const y = height - 2 - ((val - min) / range) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={(width - 4) + 2}
          cy={height - 2 - ((data[data.length - 1] - min) / range) * (height - 6)}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}

// ── 3D Mannequin Avatar Inner Mesh Component ──────────────────────────────────
interface AvatarModelProps {
  modelUrl: string;
  riskColor: string;
  hr: number;
  isReducedMotion: boolean;
  isDark: boolean;
  onBonePositionsUpdated: (positions: Record<string, [number, number, number]>) => void;
}

function AvatarModel({
  modelUrl,
  riskColor,
  hr,
  isReducedMotion,
  isDark,
  onBonePositionsUpdated,
}: AvatarModelProps) {
  const { scene } = useGLTF(modelUrl);
  const avatarGroupRef = useRef<THREE.Group>(null);
  const heartMeshRef = useRef<THREE.Mesh>(null);
  const cuffMeshRef = useRef<THREE.Mesh>(null);
  const spineRef = useRef<THREE.Object3D | null>(null);

  // Clamped heart rate frequency (45 to 120 bpm for visual calmness)
  const clampedHr = Math.min(120, Math.max(45, hr || 72));
  const cardiacBps = clampedHr / 60; // cycles per second

  // Position offsets: model height is ~1.81m, center around y = 0
  const modelYOffset = -0.9;

  // Clone scene with skeleton intact while preserving original textures and materials
  const clone = useMemo(() => {
    const clonedScene = SkeletonUtils.clone(scene);

    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.depthWrite = true;
          mat.roughness = Math.min(0.85, Math.max(0.4, mat.roughness || 0.6));
          mat.metalness = Math.min(0.25, mat.metalness || 0.05);
        }
      }
    });

    return clonedScene;
  }, [scene]);

  // Extract bone world coordinates after mounting
  useEffect(() => {
    if (!avatarGroupRef.current) return;
    avatarGroupRef.current.updateMatrixWorld(true);

    const positions: Record<string, [number, number, number]> = {};

    BODY_REGIONS.forEach((region) => {
      let foundObj: THREE.Object3D | null = null;
      for (const name of [region.boneName, ...region.boneAliases]) {
        foundObj = clone.getObjectByName(name) || null;
        if (foundObj) break;
      }

      if (foundObj) {
        const worldPos = new THREE.Vector3();
        foundObj.getWorldPosition(worldPos);
        positions[region.id] = [
          Number(worldPos.x.toFixed(3)),
          Number((worldPos.y + modelYOffset).toFixed(3)),
          Number(worldPos.z.toFixed(3)),
        ];
      } else {
        // Fallback offset
        positions[region.id] = [
          region.fallbackPosition[0],
          region.fallbackPosition[1] + modelYOffset,
          region.fallbackPosition[2],
        ];
      }
    });

    spineRef.current = clone.getObjectByName("Spine1") || clone.getObjectByName("Spine2") || null;
    onBonePositionsUpdated(positions);
  }, [clone, modelYOffset, onBonePositionsUpdated]);

  // Frame animation: gentle heart pulse and cuff subtle glow
  useFrame(({ clock }) => {
    if (isReducedMotion) return;
    const t = clock.getElapsedTime();

    // Heart pulse
    if (heartMeshRef.current) {
      const pulse = 1 + Math.sin(t * cardiacBps * Math.PI * 2) * 0.08;
      heartMeshRef.current.scale.set(pulse, pulse, pulse);
      const mat = heartMeshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.emissiveIntensity = 0.4 + Math.sin(t * cardiacBps * Math.PI * 2) * 0.3;
      }
    }

    // Cuff subtle ring breathing
    if (cuffMeshRef.current) {
      const mat = cuffMeshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) {
        mat.opacity = 0.85 + Math.sin(t * 1.5) * 0.1;
      }
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clone.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    };
  }, [clone]);

  return (
    <group ref={avatarGroupRef} position={[0, modelYOffset, 0]}>
      {/* Ready Player Me 3D Human Avatar */}
      <primitive object={clone} />

      {/* Subtle Ambient Floor Contact Shadow / Pedestal */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.75, 32]} />
        <meshBasicMaterial
          color={isDark ? "#090d16" : "#cbd5e1"}
          transparent
          opacity={isDark ? 0.35 : 0.25}
        />
      </mesh>
    </group>
  );
}

// ── Interactive HTML Hotspot Marker on Body ───────────────────────────────────
interface HotspotMarkerProps {
  region: BodyRegionConfig;
  position: [number, number, number];
  riskColor: string;
  shapeCue: { symbol: string; name: string };
  riskTierLabel: string;
  isActive: boolean;
  previewText: string;
  onClick: () => void;
  onFocus: () => void;
}

function HotspotMarker({
  region,
  position,
  riskColor,
  shapeCue,
  riskTierLabel,
  isActive,
  previewText,
  onClick,
  onFocus,
}: HotspotMarkerProps) {
  // Apply marker offset
  const finalPos: [number, number, number] = [
    position[0] + region.markerOffset[0],
    position[1] + region.markerOffset[1],
    position[2] + region.markerOffset[2],
  ];

  return (
    <Html
      position={finalPos}
      center
      distanceFactor={4.8}
      zIndexRange={[20, 60]}
      style={{ pointerEvents: "auto" }}
    >
      <button
        type="button"
        role="button"
        aria-label={`Open ${region.name} vitals hotspot. ${previewText}. Risk tier: ${riskTierLabel}`}
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        }}
        className={`group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono transition-all duration-200 cursor-pointer shadow-md select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
          isActive
            ? "ring-2 ring-white scale-110 shadow-lg"
            : "hover:scale-105 opacity-95 hover:opacity-100"
        }`}
        style={{
          background: "var(--bg-surface-strong, rgba(15, 23, 42, 0.85))",
          borderColor: riskColor,
          borderWidth: "1.5px",
          color: "var(--text-primary)",
        }}
      >
        {/* Pulsing indicator dot with shape cue */}
        <span
          className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 text-white shadow-xs"
          style={{ backgroundColor: riskColor }}
          title={`${shapeCue.name} symbol: ${riskTierLabel} risk`}
        >
          {shapeCue.symbol}
        </span>

        {/* Short anatomical & vital badge */}
        <div className="flex flex-col text-left leading-none">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            {region.id === "heart_chest"
              ? "Chest / Heart"
              : region.id === "left_arm_bp"
              ? "Arm / BP"
              : region.id === "abdomen_metabolic"
              ? "Abdomen"
              : "Head"}
          </span>
          <span className="text-[11px] font-bold text-[var(--text-primary)]">
            {previewText}
          </span>
        </div>
      </button>
    </Html>
  );
}

// ── Main BodyTwinViz Props ────────────────────────────────────────────────────
export interface BodyTwinVizProps {
  riskTier: RiskTier | null;
  riskScore?: number | null;
  sbp?: number | null;
  dbp?: number | null;
  bmi?: number | null;
  hr?: number | null;
  weight?: number | null;
  glucose?: number | null;
  hba1c?: number | null;
  age?: number | null;
  gender?: string | null;
  medications?: { name: string; display_name?: string }[] | null;
  asOfDate?: string | null;
  sparklineSbp?: number[];
  // Baseline values (for before/after comparison)
  baselineVitals?: {
    sbp?: number | null;
    dbp?: number | null;
    bmi?: number | null;
    hr?: number | null;
    weight?: number | null;
    glucose?: number | null;
    hba1c?: number | null;
    riskScore?: number | null;
    riskTier?: string | null;
  };
  className?: string;
  onFallbackToCore?: () => void;
}

export default function BodyTwinViz({
  riskTier,
  riskScore,
  sbp,
  dbp,
  bmi,
  hr,
  weight,
  glucose,
  hba1c,
  age,
  gender,
  medications,
  asOfDate,
  sparklineSbp = [],
  baselineVitals,
  className = "",
  onFallbackToCore,
}: BodyTwinVizProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Check WebGL availability
  const webGLSupported = useMemo(() => isWebGLAvailable(), []);
  const [hasWebGLError, setHasWebGLError] = useState(false);

  // Accessible Table Accordion State
  const [showAccessibleTable, setShowAccessibleTable] = useState(false);

  // Active Selected Hotspot Card
  const [activeRegionId, setActiveRegionId] = useState<string | null>("heart_chest");

  // Avatar gender toggle / auto-detect
  const isFemaleDefault = useMemo(() => {
    const g = (gender || "").trim().toUpperCase();
    return g.startsWith("F") || g === "FEMALE";
  }, [gender]);

  const [selectedGender, setSelectedGender] = useState<"male" | "female">(
    isFemaleDefault ? "female" : "male"
  );

  useEffect(() => {
    setSelectedGender(isFemaleDefault ? "female" : "male");
  }, [isFemaleDefault]);

  const activeModelUrl =
    selectedGender === "female" ? "/models/human-female.glb" : "/models/human-male.glb";

  // Bone world positions reported by AvatarModel
  const [bonePositions, setBonePositions] = useState<
    Record<string, [number, number, number]>
  >({
    heart_chest: [-0.05, 0.38, 0.17],
    left_arm_bp: [0.20, 0.45, -0.01],
    abdomen_metabolic: [0, 0.22, 0.04],
    head_demographics: [0, 0.75, 0.02],
  });

  const handleBonePositionsUpdated = useCallback(
    (positions: Record<string, [number, number, number]>) => {
      setBonePositions((prev) => ({ ...prev, ...positions }));
    },
    []
  );

  // Check prefers-reduced-motion
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  // Risk styling tokens
  const tier = normalizeTier(riskTier);
  const riskColor =
    tier === "High"
      ? RISK_COLORS.HIGH
      : tier === "Moderate"
      ? RISK_COLORS.MEDIUM
      : RISK_COLORS.LOW;

  const shapeCue = getRiskShapeCue(tier);

  // Active hotspot configuration
  const activeRegion = useMemo(() => {
    return BODY_REGIONS.find((r) => r.id === activeRegionId) || null;
  }, [activeRegionId]);

  // Preview text for each hotspot pill
  const getPreviewText = (regionId: string) => {
    switch (regionId) {
      case "heart_chest":
        return hr ? `${Math.round(hr)} bpm` : riskScore ? `${(riskScore * 100).toFixed(0)}%` : "HR / Risk";
      case "left_arm_bp":
        return sbp && dbp ? `${Math.round(sbp)}/${Math.round(dbp)}` : "BP Cuff";
      case "abdomen_metabolic":
        return bmi ? `BMI ${bmi.toFixed(1)}` : weight ? `${weight.toFixed(0)} kg` : "Metabolic";
      case "head_demographics":
        return age ? `${age}y · ${selectedGender === "female" ? "Female" : "Male"}` : "Profile";
      default:
        return "Vitals";
    }
  };

  // Helper for computing Before vs After delta
  const getDeltaBadge = (current: number | null | undefined, baseline: number | null | undefined, unit: string) => {
    if (current == null || baseline == null) return null;
    const diff = Number((current - baseline).toFixed(1));
    if (Math.abs(diff) < 0.05) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded">
          <Minus className="w-2.5 h-2.5" /> Baseline
        </span>
      );
    }
    const isIncrease = diff > 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
          isIncrease
            ? "text-rose-600 bg-rose-500/10 dark:text-rose-400"
            : "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
        }`}
      >
        {isIncrease ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
        {isIncrease ? `+${diff}` : `${diff}`} {unit}
      </span>
    );
  };

  // If WebGL is not available, render Fallback with accessible core view
  if (!webGLSupported || hasWebGLError) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>WebGL Acceleration Notice:</strong> Hardware 3D is unavailable or encountered an error.
            </span>
          </div>
        </div>

        {/* Accessible vitals table */}
        <AccessibleVitalsTable
          sbp={sbp}
          dbp={dbp}
          hr={hr}
          bmi={bmi}
          weight={weight}
          glucose={glucose}
          hba1c={hba1c}
          age={age}
          gender={gender}
          riskScore={riskScore}
          riskTier={riskTier}
          asOfDate={asOfDate}
          baselineVitals={baselineVitals}
        />
      </div>
    );
  }

  return (
    <div className={`relative w-full select-none space-y-3 ${className}`}>
      {/* ── Main 3D Canvas Container ───────────────────────────────────────── */}
      <div className="relative h-[520px] sm:h-[580px] lg:h-[640px] w-full rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900/10 via-slate-900/5 to-slate-900/20 dark:from-slate-950/80 dark:via-slate-900/60 dark:to-slate-950/90 border border-[var(--glass-border)] shadow-inner">
        {/* Top-Left: Model & Synthetic Patient Regulatory Notice */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none flex flex-col gap-1 max-w-[280px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--glass-border)] shadow-xs">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center text-[8px] text-white font-bold"
              style={{ backgroundColor: riskColor }}
            >
              {shapeCue.symbol}
            </span>
            <span className="text-[10px] font-mono font-bold tracking-tight text-[var(--text-primary)]">
              3D Human Digital Twin
            </span>
          </div>
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-md border w-fit"
            style={{
              color: riskColor,
              borderColor: `${riskColor}40`,
              backgroundColor: `${riskColor}15`,
            }}
          >
            {shapeCue.symbol} {tier.toUpperCase()} TIER · {shapeCue.name.toUpperCase()} SHAPE CUE
          </span>
        </div>

        {/* Top-Right: Interaction & Controls HUD */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
          {/* Avatar Gender Toggle */}
          <div className="flex rounded-lg border border-[var(--glass-border)] p-0.5 bg-[var(--bg-surface)] backdrop-blur-md shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedGender("male")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                selectedGender === "male"
                  ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title="Switch to Male Avatar"
            >
              ♂ Male
            </button>
            <button
              type="button"
              onClick={() => setSelectedGender("female")}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                selectedGender === "female"
                  ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
              title="Switch to Female Avatar"
            >
              ♀ Female
            </button>
          </div>

          <div className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-1 rounded-lg border border-[var(--glass-border)] backdrop-blur-md shadow-xs hidden sm:block">
            Drag to rotate · Click hotspots
          </div>
        </div>

        {/* ── 3D Canvas Scene ─────────────────────────────────────────────── */}
        <Canvas
          camera={{ position: [0, 0.05, 3.25], fov: 34 }}
          dpr={[1, 2]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
          }}
          style={{ background: "transparent" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
          onError={() => setHasWebGLError(true)}
        >
          {/* Editorial Studio Lighting (Soft, calm, non-sci-fi) */}
          <ambientLight intensity={isDark ? 0.7 : 0.9} />
          <directionalLight
            position={[2, 3, 2.5]}
            intensity={isDark ? 1.3 : 1.1}
            color="#f8fafc"
            castShadow
          />
          <directionalLight
            position={[-2, 1, -1]}
            intensity={isDark ? 0.55 : 0.4}
            color="#e2e8f0"
          />
          {/* Subtle warm rim light */}
          <pointLight
            position={[0, 2, -2]}
            intensity={0.5}
            color={riskColor}
          />

          {/* Model with Suspense Skeleton Placeholder */}
          <Suspense fallback={<LoadingSkeletonFallback isDark={isDark} />}>
            <AvatarModel
              modelUrl={activeModelUrl}
              riskColor={riskColor}
              hr={hr || 72}
              isReducedMotion={isReducedMotion}
              isDark={isDark}
              onBonePositionsUpdated={handleBonePositionsUpdated}
            />

            {/* Hotspots mapped to body bones */}
            {BODY_REGIONS.map((region) => {
              const pos = bonePositions[region.id] || region.fallbackPosition;
              return (
                <HotspotMarker
                  key={region.id}
                  region={region}
                  position={pos}
                  riskColor={riskColor}
                  shapeCue={shapeCue}
                  riskTierLabel={tier}
                  isActive={activeRegionId === region.id}
                  previewText={getPreviewText(region.id)}
                  onClick={() =>
                    setActiveRegionId((prev) => (prev === region.id ? null : region.id))
                  }
                  onFocus={() => setActiveRegionId(region.id)}
                />
              );
            })}
          </Suspense>

          {/* Orbit Controls with bounded angles */}
          <OrbitControls
            enablePan={false}
            minDistance={1.8}
            maxDistance={4.5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={(2 * Math.PI) / 3}
            target={[0, 0.02, 0]}
            autoRotate
            autoRotateSpeed={0.35}
            makeDefault
          />
        </Canvas>

        {/* ── Active Hotspot Detail Card Overlay ────────────────────────── */}
        {activeRegion && (
          <div className="absolute bottom-6 sm:bottom-10 left-2.5 right-2.5 sm:right-auto sm:left-4 sm:max-w-md z-30 pointer-events-auto max-h-[75vh] sm:max-h-[85%] overflow-y-auto">
            <div className="glass-modal p-3.5 sm:p-4 rounded-2xl border border-[var(--glass-border)] shadow-2xl backdrop-blur-xl space-y-3 bg-[var(--bg-surface-strong)]/95">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 border-b border-[var(--border-hairline)] pb-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[8px] text-white"
                      style={{ backgroundColor: riskColor }}
                    >
                      {shapeCue.symbol}
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                      {activeRegion.name}
                    </h4>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                    {activeRegion.anatomicalLabel} · Bone: <code>{activeRegion.boneName}</code>
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close hotspot card"
                  onClick={() => setActiveRegionId(null)}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Vitals Grid for this region */}
              <div className="grid grid-cols-2 gap-2.5">
                {activeRegion.vitals.map((v) => {
                  let currentVal: number | string | null | undefined = null;
                  let baselineVal: number | string | null | undefined = null;

                  if (v.key === "hr") {
                    currentVal = hr ? Math.round(hr) : null;
                    baselineVal = baselineVitals?.hr ? Math.round(baselineVitals.hr) : null;
                  } else if (v.key === "riskScore") {
                    currentVal = riskScore ? (riskScore * 100).toFixed(1) : null;
                    baselineVal = baselineVitals?.riskScore ? (baselineVitals.riskScore * 100).toFixed(1) : null;
                  } else if (v.key === "riskTier") {
                    currentVal = tier;
                    baselineVal = baselineVitals?.riskTier || null;
                  } else if (v.key === "sbp") {
                    currentVal = sbp ? Math.round(sbp) : null;
                    baselineVal = baselineVitals?.sbp ? Math.round(baselineVitals.sbp) : null;
                  } else if (v.key === "dbp") {
                    currentVal = dbp ? Math.round(dbp) : null;
                    baselineVal = baselineVitals?.dbp ? Math.round(baselineVitals.dbp) : null;
                  } else if (v.key === "pulse_pressure") {
                    currentVal = sbp && dbp ? Math.round(sbp - dbp) : null;
                    baselineVal =
                      baselineVitals?.sbp && baselineVitals?.dbp
                        ? Math.round(baselineVitals.sbp - baselineVitals.dbp)
                        : null;
                  } else if (v.key === "weight") {
                    currentVal = weight ? weight.toFixed(1) : null;
                    baselineVal = baselineVitals?.weight ? baselineVitals.weight.toFixed(1) : null;
                  } else if (v.key === "bmi") {
                    currentVal = bmi ? bmi.toFixed(1) : null;
                    baselineVal = baselineVitals?.bmi ? baselineVitals.bmi.toFixed(1) : null;
                  } else if (v.key === "glucose") {
                    currentVal = glucose ? Math.round(glucose) : null;
                    baselineVal = baselineVitals?.glucose ? Math.round(baselineVitals.glucose) : null;
                  } else if (v.key === "hba1c") {
                    currentVal = hba1c ? hba1c.toFixed(1) : null;
                    baselineVal = baselineVitals?.hba1c ? baselineVitals.hba1c.toFixed(1) : null;
                  } else if (v.key === "age") {
                    currentVal = age != null ? age : null;
                  } else if (v.key === "gender") {
                    currentVal = gender || "Recorded";
                  } else if (v.key === "medications") {
                    currentVal = medications ? `${medications.length} active` : "None recorded";
                  }

                  const status = evaluateVitalStatus(v.key, currentVal);

                  return (
                    <div
                      key={v.key}
                      className="p-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-hairline)] space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
                        <span>{v.label}</span>
                        {status === "elevated" && (
                          <span className="text-amber-500 font-bold">Elevated</span>
                        )}
                        {status === "high" && (
                          <span className="text-rose-500 font-bold">Stage 2</span>
                        )}
                        {status === "normal" && (
                          <span className="text-emerald-500 font-bold">Normal</span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold font-mono text-[var(--text-primary)]">
                          {currentVal ?? "—"}
                        </span>
                        {v.unit && (
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {v.unit}
                          </span>
                        )}
                      </div>

                      {/* Before / After Simulator Delta */}
                      {typeof currentVal === "number" && typeof baselineVal === "number" && (
                        <div>{getDeltaBadge(currentVal, baselineVal, v.unit)}</div>
                      )}

                      <div className="text-[9px] text-[var(--text-muted)] font-mono pt-0.5 border-t border-[var(--border-hairline)]">
                        Target: {v.normalRange}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sparkline & As-Of Date */}
              <div className="flex items-center justify-between pt-1 text-[10px] font-mono border-t border-[var(--border-hairline)]">
                <span className="text-[var(--text-muted)]">
                  As-of: <strong>{asOfDate || "Current Snapshot"}</strong>
                </span>
                {activeRegion.id === "left_arm_bp" && sparklineSbp.length > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[var(--text-muted)]">SBP Trend:</span>
                    <MicroSparkline data={sparklineSbp} color={riskColor} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Banner: Mandatory Legal & Clinical Accuracy Statement */}
        <p className="absolute bottom-2 inset-x-0 text-center text-[10px] font-mono text-[var(--text-muted)] pointer-events-none px-4">
          Illustrative body model. It does not represent this patient&apos;s anatomy.
        </p>
      </div>

      {/* ── Accessible Alternative Toggle ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 px-1">
        <button
          type="button"
          onClick={() => setShowAccessibleTable((prev) => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline cursor-pointer min-h-[36px]"
        >
          <TableIcon className="w-3.5 h-3.5" />
          <span>
            {showAccessibleTable ? "Hide Vitals Data Table" : "View Vitals Data Table (Accessible Alternative)"}
          </span>
        </button>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          WCAG 2.1 AA Compliant · Keyboard Navigable
        </span>
      </div>

      {/* ── Collapsible Accessible Vitals Table ────────────────────────────── */}
      {showAccessibleTable && (
        <AccessibleVitalsTable
          sbp={sbp}
          dbp={dbp}
          hr={hr}
          bmi={bmi}
          weight={weight}
          glucose={glucose}
          hba1c={hba1c}
          age={age}
          gender={gender}
          riskScore={riskScore}
          riskTier={riskTier}
          asOfDate={asOfDate}
          baselineVitals={baselineVitals}
        />
      )}
    </div>
  );
}

// ── Accessible Data Table Fallback Component ──────────────────────────────────
function AccessibleVitalsTable({
  sbp,
  dbp,
  hr,
  bmi,
  weight,
  glucose,
  hba1c,
  age,
  gender,
  riskScore,
  riskTier,
  asOfDate,
  baselineVitals,
}: {
  sbp?: number | null;
  dbp?: number | null;
  hr?: number | null;
  bmi?: number | null;
  weight?: number | null;
  glucose?: number | null;
  hba1c?: number | null;
  age?: number | null;
  gender?: string | null;
  riskScore?: number | null;
  riskTier?: RiskTier | null;
  asOfDate?: string | null;
  baselineVitals?: BodyTwinVizProps["baselineVitals"];
}) {
  const rows = [
    {
      region: "Heart / Chest",
      vital: "Heart Rate",
      current: hr != null ? `${Math.round(hr)} bpm` : "—",
      baseline: baselineVitals?.hr != null ? `${Math.round(baselineVitals.hr)} bpm` : "—",
      normal: "60–100 bpm",
      status: evaluateVitalStatus("hr", hr),
    },
    {
      region: "Heart / Chest",
      vital: "10-Yr Cardiovascular Risk",
      current: riskScore != null ? `${(riskScore * 100).toFixed(1)}% (${riskTier || "Low"})` : "—",
      baseline:
        baselineVitals?.riskScore != null
          ? `${(baselineVitals.riskScore * 100).toFixed(1)}% (${baselineVitals.riskTier || "Low"})`
          : "—",
      normal: "< 10.0% (Low Risk)",
      status: riskTier?.toUpperCase().includes("HIGH")
        ? "high"
        : riskTier?.toUpperCase().includes("MOD")
        ? "elevated"
        : "normal",
    },
    {
      region: "Left Upper Arm",
      vital: "Systolic Blood Pressure",
      current: sbp != null ? `${Math.round(sbp)} mmHg` : "—",
      baseline: baselineVitals?.sbp != null ? `${Math.round(baselineVitals.sbp)} mmHg` : "—",
      normal: "< 120 mmHg",
      status: evaluateVitalStatus("sbp", sbp),
    },
    {
      region: "Left Upper Arm",
      vital: "Diastolic Blood Pressure",
      current: dbp != null ? `${Math.round(dbp)} mmHg` : "—",
      baseline: baselineVitals?.dbp != null ? `${Math.round(baselineVitals.dbp)} mmHg` : "—",
      normal: "< 80 mmHg",
      status: evaluateVitalStatus("dbp", dbp),
    },
    {
      region: "Abdomen / Hips",
      vital: "Body Weight",
      current: weight != null ? `${weight.toFixed(1)} kg` : "—",
      baseline: baselineVitals?.weight != null ? `${baselineVitals.weight.toFixed(1)} kg` : "—",
      normal: "Target BMI 18.5–24.9",
      status: "normal",
    },
    {
      region: "Abdomen / Hips",
      vital: "Body Mass Index (BMI)",
      current: bmi != null ? `${bmi.toFixed(1)} kg/m²` : "—",
      baseline: baselineVitals?.bmi != null ? `${baselineVitals.bmi.toFixed(1)} kg/m²` : "—",
      normal: "18.5–24.9 kg/m²",
      status: evaluateVitalStatus("bmi", bmi),
    },
    {
      region: "Abdomen / Hips",
      vital: "Fasting Blood Glucose",
      current: glucose != null ? `${Math.round(glucose)} mg/dL` : "—",
      baseline: baselineVitals?.glucose != null ? `${Math.round(baselineVitals.glucose)} mg/dL` : "—",
      normal: "70–99 mg/dL",
      status: evaluateVitalStatus("glucose", glucose),
    },
    {
      region: "Abdomen / Hips",
      vital: "Glycated Hemoglobin (HbA1c)",
      current: hba1c != null ? `${hba1c.toFixed(1)}%` : "—",
      baseline: baselineVitals?.hba1c != null ? `${baselineVitals.hba1c.toFixed(1)}%` : "—",
      normal: "< 5.7%",
      status: evaluateVitalStatus("hba1c", hba1c),
    },
    {
      region: "Head / Cranium",
      vital: "Patient Demographics",
      current: `${age ?? "—"}y · ${gender ?? "—"}`,
      baseline: "—",
      normal: "Baseline record",
      status: "normal",
    },
  ];

  return (
    <div className="glass-card p-3 sm:p-4 rounded-xl border border-[var(--glass-border)] space-y-2 overflow-x-auto responsive-table-container">
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2 flex-wrap gap-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
          Clinical Physiological Telemetry Table
        </h4>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">
          As of: {asOfDate || "Current"}
        </span>
      </div>

      <table className="w-full min-w-[620px] text-xs text-left font-mono">
        <thead>
          <tr className="border-b border-[var(--border-hairline)] text-[var(--text-muted)] text-[10px] uppercase">
            <th className="py-1.5 pr-3">Anatomical Region</th>
            <th className="py-1.5 px-3">Vital Parameter</th>
            <th className="py-1.5 px-3">Current / Scenario</th>
            <th className="py-1.5 px-3">Baseline</th>
            <th className="py-1.5 px-3">Normal Range</th>
            <th className="py-1.5 pl-3">Clinical Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-hairline)]">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[var(--bg-subtle)] transition">
              <td className="py-1.5 pr-3 text-[var(--text-muted)]">{r.region}</td>
              <td className="py-1.5 px-3 font-semibold text-[var(--text-primary)]">{r.vital}</td>
              <td className="py-1.5 px-3 font-bold">{r.current}</td>
              <td className="py-1.5 px-3 text-[var(--text-muted)]">{r.baseline}</td>
              <td className="py-1.5 px-3 text-[var(--text-muted)]">{r.normal}</td>
              <td className="py-1.5 pl-3">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    r.status === "high"
                      ? "text-rose-600 bg-rose-500/10"
                      : r.status === "elevated"
                      ? "text-amber-600 bg-amber-500/10"
                      : "text-emerald-600 bg-emerald-500/10"
                  }`}
                >
                  {r.status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Placeholder Skeleton Fallback while Loading ───────────────────────────────
function LoadingSkeletonFallback({ isDark }: { isDark: boolean }) {
  return (
    <group position={[0, 0, 0]}>
      {/* Abstract wireframe placeholder skeleton */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial
          color={isDark ? "#475569" : "#94a3b8"}
          wireframe
          transparent
          opacity={0.4}
        />
      </mesh>
      {/* Torso wireframe */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.18, 0.14, 0.6, 16, 4, true]} />
        <meshBasicMaterial
          color={isDark ? "#475569" : "#94a3b8"}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>
      {/* Legs wireframe */}
      <mesh position={[-0.08, -0.3, 0]}>
        <cylinderGeometry args={[0.06, 0.04, 0.7, 12, 4, true]} />
        <meshBasicMaterial
          color={isDark ? "#475569" : "#94a3b8"}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      <mesh position={[0.08, -0.3, 0]}>
        <cylinderGeometry args={[0.06, 0.04, 0.7, 12, 4, true]} />
        <meshBasicMaterial
          color={isDark ? "#475569" : "#94a3b8"}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>
      <Html center>
        <div className="flex flex-col items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 text-white border border-slate-700 shadow-xl backdrop-blur-md">
          <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono">Loading Human Rig…</span>
        </div>
      </Html>
    </group>
  );
}

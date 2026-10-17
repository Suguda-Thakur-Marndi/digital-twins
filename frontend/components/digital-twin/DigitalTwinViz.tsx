"use client";

import React, { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { RiskTier, RISK_COLORS, normalizeTier } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { getRiskShapeCue } from "@/lib/bodyMap";
import {
  Heart,
  Activity,
  Scale,
  Zap,
  AlertTriangle,
  Pin,
  CheckCircle2,
} from "lucide-react";

// Preload Ready Player Me 3D human models
useGLTF.preload("/models/human-male.glb");
useGLTF.preload("/models/human-female.glb");

// -- Props ---------------------------------------------------------------------
export interface DigitalTwinVizProps {
  riskTier: RiskTier | null;
  loading?: boolean;
  error?: string | null;
  sbp?: number | null;
  dbp?: number | null;
  bmi?: number | null;
  hr?: number | null;
  weight?: number | null;
  glucose?: number | null;
  hba1c?: number | null;
  age?: number | null;
  gender?: string | null;
  riskScore?: number | null;
  patientName?: string;
  height?: string;
  className?: string;
}

// -- Clinical evaluation helpers -----------------------------------------------
function getBpCategory(sbp: number, dbp: number): { label: string; color: string } {
  if (sbp >= 140 || dbp >= 90) return { label: "Stage 2 HTN", color: "#f43f5e" };
  if (sbp >= 130 || dbp >= 80) return { label: "Stage 1 HTN", color: "#f59e0b" };
  if (sbp >= 120 && dbp < 80) return { label: "Elevated", color: "#38bdf8" };
  return { label: "Optimal", color: "#10b981" };
}

function getHrCategory(hr: number): { label: string; color: string } {
  if (hr > 100) return { label: "Tachycardia", color: "#f43f5e" };
  if (hr < 60) return { label: "Bradycardia", color: "#38bdf8" };
  return { label: "Normal", color: "#10b981" };
}

function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi >= 30) return { label: "Obesity", color: "#f43f5e" };
  if (bmi >= 25) return { label: "Overweight", color: "#f59e0b" };
  if (bmi >= 18.5) return { label: "Normal weight", color: "#10b981" };
  return { label: "Underweight", color: "#38bdf8" };
}

function getPpCategory(pp: number): { label: string; color: string } {
  if (pp > 60) return { label: "Stiff Arteries", color: "#f43f5e" };
  if (pp > 50) return { label: "Borderline", color: "#f59e0b" };
  return { label: "Normal", color: "#10b981" };
}

// -- Clean 3D Human Avatar (Centered vertically at origin) ---------------------
function HumanAvatar({
  modelUrl,
  isDark,
  onPointerOver,
  onPointerOut,
}: {
  modelUrl: string;
  isDark: boolean;
  onPointerOver: () => void;
  onPointerOut: () => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const avatarGroupRef = useRef<THREE.Group>(null);
  const spineRef = useRef<THREE.Object3D | null>(null);

  // Model spans ~ [-0.04m, 1.86m] in Y. Offset by -0.91m centers head-to-toe around Y = 0.
  const modelYOffset = -0.91;

  // Clone scene with skeleton intact while preserving original textures and materials
  const clone = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);

    cloned.traverse((child) => {
      // Ensure novelty accessories (e.g. reindeer glasses / clown nose) are hidden
      if (
        child.name === "Wolf3D_Glasses" ||
        child.name.toLowerCase().includes("glasses") ||
        (child as THREE.Mesh).name === "Wolf3D_Glasses"
      ) {
        child.visible = false;
        return;
      }

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

    return cloned;
  }, [scene]);

  useEffect(() => {
    if (!avatarGroupRef.current) return;
    avatarGroupRef.current.updateMatrixWorld(true);
    spineRef.current = clone.getObjectByName("Spine1") || clone.getObjectByName("Spine2") || null;
  }, [clone]);

  // Subtle natural breathing cycle on spine
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (spineRef.current) {
      spineRef.current.rotation.x = Math.sin(t * 1.5) * 0.012;
    }
  });

  return (
    <group
      ref={avatarGroupRef}
      position={[0, modelYOffset, 0]}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      {/* Ready Player Me 3D Human Avatar */}
      <primitive object={clone} />

      {/* Subtle floor contact shadow pedestal directly beneath feet */}
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.72, 32]} />
        <meshBasicMaterial
          color={isDark ? "#020617" : "#cbd5e1"}
          transparent
          opacity={isDark ? 0.45 : 0.25}
        />
      </mesh>
    </group>
  );
}

// -- Anatomical Hotspot Anchors Calibration ----------------------------------
// Derived from vertex buffers of Wolf3D_Outfit_Top & Wolf3D_Body in human-male.glb & human-female.glb (model offset Y = -0.91m)
function getHotspotAnchors(isFemale: boolean) {
  return {
    heart: {
      pos: [0.045, 0.365, isFemale ? 0.155 : 0.133] as [number, number, number],
      normal: [0.15, 0.0, 0.98] as [number, number, number],
    },
    bmi: {
      pos: [0.0, 0.445, isFemale ? 0.144 : 0.139] as [number, number, number],
      normal: [0.0, 0.05, 0.99] as [number, number, number],
    },
    bp: {
      pos: [-0.35, 0.36, isFemale ? -0.005 : -0.02] as [number, number, number],
      normal: [-0.9, 0.05, 0.42] as [number, number, number],
    },
    pp: {
      pos: [isFemale ? 0.405 : 0.45, 0.125, isFemale ? 0.075 : 0.065] as [number, number, number],
      normal: [0.65, 0.1, 0.75] as [number, number, number],
    },
  };
}

interface HotspotConfig {
  id: "heart" | "bp" | "pp" | "bmi";
  pos: [number, number, number];
  normal: [number, number, number];
  ref: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  isPinned: boolean;
}

// -- Hardware-Accelerated 3D-to-2D Viewport Projector (Runs inside R3F Scene) ---
function HotspotProjector({ configs }: { configs: HotspotConfig[] }) {
  const { camera, size } = useThree();
  const tempVec = useRef(new THREE.Vector3());
  const dirVec = useRef(new THREE.Vector3());
  const posVecs = useMemo(
    () => configs.map((c) => new THREE.Vector3(...c.pos)),
    [configs]
  );
  const normalVecs = useMemo(
    () => configs.map((c) => new THREE.Vector3(...c.normal).normalize()),
    [configs]
  );

  useFrame(() => {
    if (size.width === 0 || size.height === 0) return;
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const el = cfg.ref.current;
      if (!el) continue;

      const pVec = posVecs[i];
      const nVec = normalVecs[i];

      tempVec.current.copy(pVec).project(camera);

      // Check if behind camera plane
      const isBehind = tempVec.current.z > 1;

      // Check angle with camera
      dirVec.current.subVectors(camera.position, pVec).normalize();
      const dot = dirVec.current.dot(nVec);
      const isFacing = cfg.isActive || cfg.isPinned || dot > -0.35;

      if (isBehind || !isFacing) {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      } else {
        const screenX = tempVec.current.x * widthHalf + widthHalf;
        const screenY = -(tempVec.current.y * heightHalf) + heightHalf;

        el.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
      }
    }
  });

  return null;
}

// -- Compact Anatomical Hotspot Card Component (Zero-Root Pure DOM) -------------
interface AnatomicalHotspotCardProps {
  id: "heart" | "bp" | "pp" | "bmi";
  side: "left" | "right";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  unit: string;
  statusLabel: string;
  statusColor: string;
  subValue?: string;
  accentColor: string;
  isActive: boolean;
  isPinned: boolean;
  domRef: React.RefObject<HTMLDivElement | null>;
  onTogglePin: () => void;
  onHover: () => void;
  onLeave: () => void;
}

function AnatomicalHotspotCard({
  id,
  side,
  icon: Icon,
  title,
  value,
  unit,
  statusLabel,
  statusColor,
  subValue,
  accentColor,
  isActive,
  isPinned,
  domRef,
  onTogglePin,
  onHover,
  onLeave,
}: AnatomicalHotspotCardProps) {
  const isLeft = side === "left";

  return (
    <div
      ref={domRef}
      className="absolute top-0 left-0 select-none pointer-events-auto transition-opacity duration-200"
      style={{ transform: "translate3d(-9999px, -9999px, 0)", opacity: 0 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* 1. Hotspot Anchor Pulse Dot on Anatomical Surface */}
      <button
        type="button"
        onClick={onTogglePin}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label={`${title}: ${value} ${unit} (${statusLabel}). Click to pin.`}
        title={`${title}: ${value} ${unit} · Click to pin`}
      >
        {/* Outer Breathing Pulse Ring */}
        <span
          className="absolute w-4 h-4 rounded-full animate-ping opacity-60"
          style={{
            backgroundColor: accentColor,
            animationDuration: id === "heart" ? "1.1s" : "2s",
          }}
        />
        {/* Inner Core Dot */}
        <span
          className={`w-2.5 h-2.5 rounded-full border border-white/90 shadow-md transition-transform duration-200 ${
            isActive ? "scale-125 ring-2 ring-white/70" : "group-hover:scale-125"
          }`}
          style={{ backgroundColor: accentColor }}
        />
      </button>

      {/* 2. Delicate Leader Line connecting Anchor to Card */}
      {isLeft ? (
        <svg
          className={`absolute pointer-events-none transition-opacity duration-200 ${
            isActive ? "opacity-100" : "opacity-0"
          }`}
          style={{
            right: 2,
            top: -8,
            width: 50,
            height: 20,
            overflow: "visible",
          }}
        >
          <polyline
            points="48,8 24,8 0,8"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.25"
            strokeDasharray="2,2"
          />
          <circle cx="0" cy="8" r="1.75" fill={accentColor} />
        </svg>
      ) : (
        <svg
          className={`absolute pointer-events-none transition-opacity duration-200 ${
            isActive ? "opacity-100" : "opacity-0"
          }`}
          style={{
            left: 2,
            top: -8,
            width: 50,
            height: 20,
            overflow: "visible",
          }}
        >
          <polyline
            points="0,8 24,8 48,8"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.25"
            strokeDasharray="2,2"
          />
          <circle cx="48" cy="8" r="1.75" fill={accentColor} />
        </svg>
      )}

      {/* 3. Compact Anatomical Telemetry Indicator Card */}
      <div
        className={`absolute transition-all duration-200 ease-out ${
          isActive
            ? "opacity-100 scale-100 pointer-events-auto"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
        style={{
          [isLeft ? "right" : "left"]: 48,
          top: -26,
          width: isLeft ? 152 : 160,
        }}
      >
        <div
          className="rounded-xl border shadow-xl backdrop-blur-md p-2 bg-slate-950/90 dark:bg-slate-950/95"
          style={{
            borderColor: `${accentColor}55`,
            boxShadow: `0 8px 24px -4px rgba(0,0,0,0.6), 0 0 10px -2px ${accentColor}25`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: `${accentColor}18`,
                borderColor: `${accentColor}40`,
                color: accentColor,
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col min-w-0 flex-1 leading-none">
              <span className="text-[8px] font-mono uppercase tracking-wider text-slate-400 font-semibold truncate">
                {title}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xs sm:text-sm font-mono font-bold text-white tracking-tight">
                  {value}
                </span>
                <span className="text-[8px] font-mono text-slate-400">{unit}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="text-[7.5px] font-mono px-1 py-0.2 rounded font-medium border"
                  style={{
                    color: statusColor,
                    borderColor: `${statusColor}40`,
                    backgroundColor: `${statusColor}15`,
                  }}
                >
                  {statusLabel}
                </span>
                {subValue && (
                  <span className="text-[7.5px] font-mono text-slate-400 truncate">
                    {subValue}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Main 3D Canvas Scene ------------------------------------------------------
function Scene({
  modelUrl,
  riskColor,
  isDark,
  hotspotConfigs,
  activeHotspot,
  isPinned,
  onHoverHotspot,
  onLeaveHotspot,
  onTogglePinHotspot,
  onAvatarPointerOver,
  onAvatarPointerOut,
}: {
  modelUrl: string;
  riskColor: string;
  isDark: boolean;
  hotspotConfigs: HotspotConfig[];
  activeHotspot: "heart" | "bp" | "pp" | "bmi" | null;
  isPinned: boolean;
  onHoverHotspot: (id: "heart" | "bp" | "pp" | "bmi") => void;
  onLeaveHotspot: () => void;
  onTogglePinHotspot: (id: "heart" | "bp" | "pp" | "bmi") => void;
  onAvatarPointerOver: () => void;
  onAvatarPointerOut: () => void;
}) {
  return (
    <>
      {/* Studio Lighting Tailored for Ready Player Me Mannequin */}
      <ambientLight intensity={isDark ? 0.75 : 0.95} />
      <directionalLight position={[2, 3, 2.5]} intensity={isDark ? 1.4 : 1.2} color="#ffffff" castShadow />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={isDark ? 0.6 : 0.45} color="#e0f2fe" />
      {/* Subtle clinical rim light */}
      <pointLight position={[0, 1.5, -2]} intensity={0.5} color={riskColor} />
      {/* Soft fill light from below */}
      <pointLight position={[0, -0.8, 1]} intensity={isDark ? 0.25 : 0.15} color="#38bdf8" />

      {/* Clean Human Avatar loaded asynchronously via Suspense */}
      <Suspense fallback={null}>
        <HumanAvatar
          modelUrl={modelUrl}
          isDark={isDark}
          onPointerOver={onAvatarPointerOver}
          onPointerOut={onAvatarPointerOut}
        />
      </Suspense>

      {/* Raycasting invisible hover hitboxes over anatomical zones (compact 0.08m radius prevents overlap) */}
      {hotspotConfigs.map((cfg) => (
        <mesh
          key={cfg.id}
          position={cfg.pos}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHoverHotspot(cfg.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onLeaveHotspot();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePinHotspot(cfg.id);
          }}
          visible={false}
        >
          <sphereGeometry args={[0.08, 12, 12]} />
        </mesh>
      ))}

      {/* Synchronous 3D-to-2D Coordinate Projector for zero-root DOM hotspots */}
      <HotspotProjector configs={hotspotConfigs} />

      {/* Orbit Controls with full body framing bounds */}
      <OrbitControls
        enablePan={false}
        minDistance={1.8}
        maxDistance={4.5}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={(2 * Math.PI) / 3}
        target={[0, 0.02, 0]}
        autoRotate={!isPinned && !activeHotspot}
        autoRotateSpeed={0.35}
        makeDefault
      />
    </>
  );
}

// -- Public DigitalTwinViz Component -------------------------------------------
export default function DigitalTwinViz({
  riskTier,
  loading,
  error,
  sbp,
  dbp,
  bmi,
  hr,
  weight,
  glucose,
  hba1c,
  age,
  gender,
  riskScore,
  patientName,
  height,
  className = "",
}: DigitalTwinVizProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Hover and Pin states
  const [activeHotspot, setActiveHotspot] = useState<"heart" | "bp" | "pp" | "bmi" | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleHoverHotspot = (id: "heart" | "bp" | "pp" | "bmi") => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveHotspot(id);
  };

  const handleLeaveHotspot = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveHotspot(null);
    }, 180);
  };

  const handleTogglePinHotspot = (id: "heart" | "bp" | "pp" | "bmi") => {
    setActiveHotspot((prev) => (prev === id ? null : id));
  };

  const handleTogglePinAll = () => {
    setIsPinned((prev) => !prev);
  };

  // Fallback defaults to match current patient telemetry
  const currentHr = hr != null ? Math.round(hr) : 89;
  const currentSbp = sbp != null ? Math.round(sbp) : 138;
  const currentDbp = dbp != null ? Math.round(dbp) : 100;
  const currentBmi = bmi != null ? Number(bmi.toFixed(1)) : 25.9;
  const currentPulsePressure = currentSbp - currentDbp;

  const bpStatus = getBpCategory(currentSbp, currentDbp);
  const hrStatus = getHrCategory(currentHr);
  const bmiStatus = getBmiCategory(currentBmi);
  const ppStatus = getPpCategory(currentPulsePressure);

  // Gender selection for 3D model: auto-detect from demographic prop, toggleable
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

  const isFemaleModel = activeModelUrl.includes("female");
  const anchors = useMemo(() => getHotspotAnchors(isFemaleModel), [isFemaleModel]);

  const hotspotHeartRef = useRef<HTMLDivElement>(null);
  const hotspotBmiRef = useRef<HTMLDivElement>(null);
  const hotspotBpRef = useRef<HTMLDivElement>(null);
  const hotspotPpRef = useRef<HTMLDivElement>(null);

  const hotspotConfigs = useMemo<HotspotConfig[]>(() => [
    {
      id: "heart",
      pos: anchors.heart.pos,
      normal: anchors.heart.normal,
      ref: hotspotHeartRef,
      isActive: isPinned || activeHotspot === "heart",
      isPinned,
    },
    {
      id: "bmi",
      pos: anchors.bmi.pos,
      normal: anchors.bmi.normal,
      ref: hotspotBmiRef,
      isActive: isPinned || activeHotspot === "bmi",
      isPinned,
    },
    {
      id: "bp",
      pos: anchors.bp.pos,
      normal: anchors.bp.normal,
      ref: hotspotBpRef,
      isActive: isPinned || activeHotspot === "bp",
      isPinned,
    },
    {
      id: "pp",
      pos: anchors.pp.pos,
      normal: anchors.pp.normal,
      ref: hotspotPpRef,
      isActive: isPinned || activeHotspot === "pp",
      isPinned,
    },
  ], [anchors, isPinned, activeHotspot]);

  // Normalize risk tier and color
  const tier = normalizeTier(riskTier);
  const riskColor =
    tier === "High"
      ? RISK_COLORS.HIGH
      : tier === "Moderate"
      ? RISK_COLORS.MEDIUM
      : RISK_COLORS.LOW;

  const shapeCue = getRiskShapeCue(tier);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center h-full min-h-[300px] gap-3 ${className}`}>
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--color-primary)]/20 animate-pulse" />
          <div className="absolute inset-2 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
        <p className="text-xs text-[var(--text-muted)] font-mono">Loading 3D Human Digital Twin...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full min-h-[300px] text-center px-6 ${className}`}>
        <div>
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-xs font-semibold text-red-400">3D Digital Twin unavailable.</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1">Verify WebGL acceleration is enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full select-none group ${className}`}
      style={height ? { height } : undefined}
    >
      {/* -- Top-Left: Risk Signal Badge & Interactive Hint -- */}
      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10 pointer-events-none flex flex-col gap-1 sm:gap-1.5 max-w-[55%] sm:max-w-none">
        {riskTier && (
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border shadow-2xs backdrop-blur-md transition-all duration-200"
            style={{
              color: riskColor,
              borderColor: `${riskColor}50`,
              background: `${riskColor}15`,
            }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: riskColor }} />
            <span className="text-[10px] sm:text-[11px] font-semibold tracking-tight truncate">
              {shapeCue.symbol} {tier} <span className="hidden sm:inline">· 365d Complication Signal</span>
            </span>
          </div>
        )}

        <div className="hidden min-[400px]:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--glass-border)] shadow-xs w-fit">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeHotspot || isPinned ? "bg-emerald-400 animate-ping" : "bg-sky-400"
            }`}
          />
          <span className="text-[9px] font-mono text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-none">
            {isPinned
              ? "Vitals Pinned · Visible"
              : activeHotspot
              ? "Pointing at Anatomical Hotspot"
              : isAvatarHovered
              ? "Hover hotspots on body to inspect"
              : "Point at model to reveal vitals"}
          </span>
        </div>
      </div>

      {/* -- Top-Right: Interaction Controls & Avatar Switcher -- */}
      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 flex items-center gap-1.5 sm:gap-2">
        {/* Pin Vitals Toggle Button */}
        <button
          type="button"
          onClick={handleTogglePinAll}
          className={`px-2 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-semibold transition cursor-pointer border backdrop-blur-md shadow-xs flex items-center gap-1 sm:gap-1.5 ${
            isPinned
              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
              : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--glass-border)] hover:text-[var(--text-primary)]"
          }`}
          title={isPinned ? "Unpin vitals markers" : "Pin all vitals markers visible"}
        >
          <Pin className={`w-3 h-3 ${isPinned ? "rotate-45 text-cyan-400" : ""}`} />
          <span className="hidden min-[380px]:inline">{isPinned ? "Pinned" : "Pin Vitals"}</span>
        </button>

        {/* Avatar Gender Toggle */}
        <div className="flex rounded-lg border border-[var(--glass-border)] p-0.5 bg-[var(--bg-surface)] backdrop-blur-md shadow-xs">
          <button
            type="button"
            onClick={() => setSelectedGender("male")}
            className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold transition cursor-pointer ${
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
            className={`px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold transition cursor-pointer ${
              selectedGender === "female"
                ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-2xs"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            title="Switch to Female Avatar"
          >
            ♀ Female
          </button>
        </div>

        <div className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-1 rounded-lg border border-[var(--glass-border)] backdrop-blur-md hidden sm:block">
          Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* -- Bottom Docked Compact Vitals Telemetry Bar (Ultra-slim, never blocks legs) -- */}
      <div className="absolute bottom-2 inset-x-2 sm:bottom-2.5 sm:inset-x-6 z-20 pointer-events-auto">
        <div className="p-1 sm:p-1.5 rounded-xl bg-slate-950/80 dark:bg-slate-950/90 backdrop-blur-md border border-white/10 shadow-lg grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-1.5">
          {/* 1. Heartbeat */}
          <button
            type="button"
            onClick={() => handleTogglePinHotspot("heart")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left min-h-[40px] ${
              activeHotspot === "heart"
                ? "border-rose-500/60 bg-rose-500/10"
                : "border-white/5 hover:border-rose-500/30"
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/40 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[7.5px] sm:text-[8px] font-mono uppercase text-slate-400 truncate">Heart Rate</span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-white flex items-center gap-1">
                {currentHr} <span className="text-[8px] text-slate-400 font-normal">bpm</span>
                <span
                  className="w-1.5 h-1.5 rounded-full ml-auto shrink-0"
                  style={{ backgroundColor: hrStatus.color }}
                />
              </span>
            </div>
          </button>

          {/* 2. Blood Pressure */}
          <button
            type="button"
            onClick={() => handleTogglePinHotspot("bp")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left min-h-[40px] ${
              activeHotspot === "bp"
                ? "border-cyan-500/60 bg-cyan-500/10"
                : "border-white/5 hover:border-cyan-500/30"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[7.5px] sm:text-[8px] font-mono uppercase text-slate-400 truncate">Blood Pressure</span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-white flex items-center justify-between gap-1">
                <span>{currentSbp}/{currentDbp}</span>
                <span
                  className="text-[7px] sm:text-[7.5px] font-mono px-1 rounded truncate max-w-[62px] sm:max-w-none text-right shrink-0"
                  style={{ color: bpStatus.color, backgroundColor: `${bpStatus.color}20` }}
                >
                  {bpStatus.label}
                </span>
              </span>
            </div>
          </button>

          {/* 3. Pulse Pressure */}
          <button
            type="button"
            onClick={() => handleTogglePinHotspot("pp")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left min-h-[40px] ${
              activeHotspot === "pp"
                ? "border-amber-400/60 bg-amber-400/10"
                : "border-white/5 hover:border-amber-400/30"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[7.5px] sm:text-[8px] font-mono uppercase text-slate-400 truncate">Pulse Pressure</span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-white flex items-center justify-between gap-1">
                <span>{currentPulsePressure} <span className="text-[8px] text-slate-400 font-normal">mmHg</span></span>
                <span
                  className="text-[7px] sm:text-[7.5px] font-mono px-1 rounded truncate max-w-[62px] sm:max-w-none text-right shrink-0"
                  style={{ color: ppStatus.color, backgroundColor: `${ppStatus.color}20` }}
                >
                  {ppStatus.label}
                </span>
              </span>
            </div>
          </button>

          {/* 4. BMI */}
          <button
            type="button"
            onClick={() => handleTogglePinHotspot("bmi")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left min-h-[40px] ${
              activeHotspot === "bmi"
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-white/5 hover:border-amber-500/30"
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[7.5px] sm:text-[8px] font-mono uppercase text-slate-400 truncate">BMI</span>
              <span className="text-[11px] sm:text-xs font-mono font-bold text-white flex items-center justify-between gap-1">
                <span>{currentBmi.toFixed(1)} <span className="text-[8px] text-slate-400 font-normal">kg/m²</span></span>
                <span
                  className="text-[7px] sm:text-[7.5px] font-mono px-1 rounded truncate max-w-[62px] sm:max-w-none text-right shrink-0"
                  style={{ color: bmiStatus.color, backgroundColor: `${bmiStatus.color}20` }}
                >
                  {bmiStatus.label}
                </span>
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* -- Hotspots 2D Overlay (Zero-Root Pure DOM Projection) -- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[15]">
        <AnatomicalHotspotCard
          id="heart"
          side="right"
          icon={Heart}
          title="Heart Rate"
          value={`${currentHr}`}
          unit="bpm"
          statusLabel={hrStatus.label}
          statusColor={hrStatus.color}
          accentColor="#f43f5e"
          isActive={isPinned || activeHotspot === "heart"}
          isPinned={isPinned}
          domRef={hotspotHeartRef}
          onTogglePin={() => handleTogglePinHotspot("heart")}
          onHover={() => handleHoverHotspot("heart")}
          onLeave={handleLeaveHotspot}
        />

        <AnatomicalHotspotCard
          id="bmi"
          side="left"
          icon={Scale}
          title="Body Mass Index"
          value={currentBmi.toFixed(1)}
          unit="kg/m²"
          statusLabel={bmiStatus.label}
          statusColor={bmiStatus.color}
          accentColor="#f59e0b"
          isActive={isPinned || activeHotspot === "bmi"}
          isPinned={isPinned}
          domRef={hotspotBmiRef}
          onTogglePin={() => handleTogglePinHotspot("bmi")}
          onHover={() => handleHoverHotspot("bmi")}
          onLeave={handleLeaveHotspot}
        />

        <AnatomicalHotspotCard
          id="bp"
          side="left"
          icon={Activity}
          title="Blood Pressure"
          value={`${currentSbp}/${currentDbp}`}
          unit="mmHg"
          statusLabel={bpStatus.label}
          statusColor={bpStatus.color}
          accentColor="#38bdf8"
          isActive={isPinned || activeHotspot === "bp"}
          isPinned={isPinned}
          domRef={hotspotBpRef}
          onTogglePin={() => handleTogglePinHotspot("bp")}
          onHover={() => handleHoverHotspot("bp")}
          onLeave={handleLeaveHotspot}
        />

        <AnatomicalHotspotCard
          id="pp"
          side="right"
          icon={Zap}
          title="Pulse Pressure"
          value={`${currentPulsePressure}`}
          unit="mmHg"
          statusLabel={ppStatus.label}
          statusColor={ppStatus.color}
          accentColor="#eab308"
          isActive={isPinned || activeHotspot === "pp"}
          isPinned={isPinned}
          domRef={hotspotPpRef}
          onTogglePin={() => handleTogglePinHotspot("pp")}
          onHover={() => handleHoverHotspot("pp")}
          onLeave={handleLeaveHotspot}
        />
      </div>

      {/* -- 3D Canvas Scene (Framed Head to Toe) -- */}
      <Canvas
        camera={{ position: [0, 0.05, 3.25], fov: 34 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Scene
          modelUrl={activeModelUrl}
          riskColor={riskColor}
          isDark={isDark}
          hotspotConfigs={hotspotConfigs}
          activeHotspot={activeHotspot}
          isPinned={isPinned}
          onHoverHotspot={handleHoverHotspot}
          onLeaveHotspot={handleLeaveHotspot}
          onTogglePinHotspot={handleTogglePinHotspot}
          onAvatarPointerOver={() => setIsAvatarHovered(true)}
          onAvatarPointerOut={() => setIsAvatarHovered(false)}
        />
      </Canvas>
    </div>
  );
}

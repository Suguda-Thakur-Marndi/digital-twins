"use client";

import React, { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
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

// -- Compact Anatomical Hotspot with Subtle Leader Line ------------------------
interface AnatomicalHotspotProps {
  id: "heart" | "bp" | "pp" | "bmi";
  side: "left" | "right";
  anchorPos: [number, number, number];
  surfaceNormal: [number, number, number];
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
  onTogglePin: () => void;
  onHover: () => void;
  onLeave: () => void;
}

function AnatomicalHotspot({
  id,
  side,
  anchorPos,
  surfaceNormal,
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
  onTogglePin,
  onHover,
  onLeave,
}: AnatomicalHotspotProps) {
  const isLeft = side === "left";
  const containerRef = useRef<HTMLDivElement>(null);
  const isFacingRef = useRef(true);

  const anchorVec = useMemo(() => new THREE.Vector3(...anchorPos), [anchorPos]);
  const normalVec = useMemo(
    () => new THREE.Vector3(...surfaceNormal).normalize(),
    [surfaceNormal]
  );
  const dirVec = useRef(new THREE.Vector3());

  // Dynamically detect camera angle and directly mutate DOM opacity to avoid React re-renders in useFrame
  useFrame(({ camera }) => {
    dirVec.current.subVectors(camera.position, anchorVec).normalize();
    const dot = dirVec.current.dot(normalVec);
    // Stay visible when facing camera, viewing in profile (dot > -0.35), or when pinned/active
    const facing = isActive || isPinned || dot > -0.35;
    if (facing !== isFacingRef.current) {
      isFacingRef.current = facing;
      if (containerRef.current) {
        if (facing) {
          containerRef.current.style.opacity = "1";
          containerRef.current.style.pointerEvents = "auto";
        } else {
          containerRef.current.style.opacity = "0";
          containerRef.current.style.pointerEvents = "none";
        }
      }
    }
  });

  return (
    <Html
      position={anchorPos}
      zIndexRange={[80, 20]}
      style={{ pointerEvents: "none" }}
    >
      <div
        ref={containerRef}
        className="relative select-none pointer-events-auto transition-opacity duration-200"
        style={{ opacity: 1 }}
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

        {/* 3. Compact Anatomical Telemetry Indicator Card (135–165px wide, 50–56px high) */}
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
    </Html>
  );
}

// -- Main 3D Canvas Scene ------------------------------------------------------
function Scene({
  modelUrl,
  riskColor,
  isDark,
  heartbeat,
  bp,
  bmiVal,
  pulsePressure,
  hrStatus,
  bpStatus,
  bmiStatus,
  ppStatus,
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
  heartbeat: number;
  bp: { sbp: number; dbp: number };
  bmiVal: number;
  pulsePressure: number;
  hrStatus: { label: string; color: string };
  bpStatus: { label: string; color: string };
  bmiStatus: { label: string; color: string };
  ppStatus: { label: string; color: string };
  activeHotspot: "heart" | "bp" | "pp" | "bmi" | null;
  isPinned: boolean;
  onHoverHotspot: (id: "heart" | "bp" | "pp" | "bmi") => void;
  onLeaveHotspot: () => void;
  onTogglePinHotspot: (id: "heart" | "bp" | "pp" | "bmi") => void;
  onAvatarPointerOver: () => void;
  onAvatarPointerOut: () => void;
}) {
  const isFemale = modelUrl.includes("female");

  // Calibrated Anatomical Anchors on the Visible Torso & Limb Surfaces
  // Derived from vertex buffers of Wolf3D_Outfit_Top & Wolf3D_Body in human-male.glb & human-female.glb (model offset Y = -0.91m):

  // A. Heart Rate — Anatomical Heart (Left chest / precordium, slightly left of sternum from patient's perspective)
  const HEART_POS: [number, number, number] = [0.045, 0.365, isFemale ? 0.155 : 0.133];
  const HEART_NORMAL: [number, number, number] = [0.15, 0.0, 0.98];

  // B. BMI — Chest (Center of upper-to-middle chest over pectoral region, below collarbone, above upper abdomen)
  const BMI_POS: [number, number, number] = [0.0, 0.445, isFemale ? 0.144 : 0.139];
  const BMI_NORMAL: [number, number, number] = [0.0, 0.05, 0.99];

  // C. Blood Pressure — Triceps (Outer upper arm between shoulder and elbow over triceps region)
  // Patient's right upper arm (X < 0), visible on the lateral/outer arm contour in front view
  const BP_POS: [number, number, number] = [-0.350, 0.360, isFemale ? -0.005 : -0.020];
  const BP_NORMAL: [number, number, number] = [-0.90, 0.05, 0.42];

  // D. Pulse Pressure — Wrist (Visible wrist surface near transition between forearm and hand)
  // Patient's left wrist (X > 0), anterior/lateral face
  const PP_POS: [number, number, number] = [isFemale ? 0.405 : 0.450, 0.125, isFemale ? 0.075 : 0.065];
  const PP_NORMAL: [number, number, number] = [0.65, 0.10, 0.75];

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
      {/* 1. Heart Precordium Hitbox */}
      <mesh
        position={HEART_POS}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverHotspot("heart");
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onLeaveHotspot();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePinHotspot("heart");
        }}
        visible={false}
      >
        <sphereGeometry args={[0.08, 12, 12]} />
      </mesh>

      {/* 2. BMI Center Chest Hitbox */}
      <mesh
        position={BMI_POS}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverHotspot("bmi");
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onLeaveHotspot();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePinHotspot("bmi");
        }}
        visible={false}
      >
        <sphereGeometry args={[0.08, 12, 12]} />
      </mesh>

      {/* 3. Blood Pressure Triceps Hitbox */}
      <mesh
        position={BP_POS}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverHotspot("bp");
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onLeaveHotspot();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePinHotspot("bp");
        }}
        visible={false}
      >
        <sphereGeometry args={[0.08, 12, 12]} />
      </mesh>

      {/* 4. Pulse Pressure Wrist Hitbox */}
      <mesh
        position={PP_POS}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverHotspot("pp");
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          onLeaveHotspot();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePinHotspot("pp");
        }}
        visible={false}
      >
        <sphereGeometry args={[0.08, 12, 12]} />
      </mesh>

      {/* 1. Heart Rate Hotspot Indicator (Rose) — Anatomical Heart (Left Chest) */}
      <AnatomicalHotspot
        id="heart"
        side="right"
        anchorPos={HEART_POS}
        surfaceNormal={HEART_NORMAL}
        icon={Heart}
        title="Heart Rate"
        value={`${heartbeat}`}
        unit="bpm"
        statusLabel={hrStatus.label}
        statusColor={hrStatus.color}
        accentColor="#f43f5e"
        isActive={isPinned || activeHotspot === "heart"}
        isPinned={isPinned}
        onTogglePin={() => onTogglePinHotspot("heart")}
        onHover={() => onHoverHotspot("heart")}
        onLeave={onLeaveHotspot}
      />

      {/* 2. BMI Hotspot Indicator (Amber) — Chest (Upper-to-Middle Chest / Pectoral) */}
      <AnatomicalHotspot
        id="bmi"
        side="left"
        anchorPos={BMI_POS}
        surfaceNormal={BMI_NORMAL}
        icon={Scale}
        title="Body Mass Index"
        value={bmiVal.toFixed(1)}
        unit="kg/m²"
        statusLabel={bmiStatus.label}
        statusColor={bmiStatus.color}
        accentColor="#f59e0b"
        isActive={isPinned || activeHotspot === "bmi"}
        isPinned={isPinned}
        onTogglePin={() => onTogglePinHotspot("bmi")}
        onHover={() => onHoverHotspot("bmi")}
        onLeave={onLeaveHotspot}
      />

      {/* 3. Blood Pressure Hotspot Indicator (Cyan) — Triceps (Outer Upper Arm) */}
      <AnatomicalHotspot
        id="bp"
        side="left"
        anchorPos={BP_POS}
        surfaceNormal={BP_NORMAL}
        icon={Activity}
        title="Blood Pressure"
        value={`${bp.sbp}/${bp.dbp}`}
        unit="mmHg"
        statusLabel={bpStatus.label}
        statusColor={bpStatus.color}
        accentColor="#38bdf8"
        isActive={isPinned || activeHotspot === "bp"}
        isPinned={isPinned}
        onTogglePin={() => onTogglePinHotspot("bp")}
        onHover={() => onHoverHotspot("bp")}
        onLeave={onLeaveHotspot}
      />

      {/* 4. Pulse Pressure Hotspot Indicator (Amber / Gold) — Wrist (Visible Forearm/Hand transition) */}
      <AnatomicalHotspot
        id="pp"
        side="right"
        anchorPos={PP_POS}
        surfaceNormal={PP_NORMAL}
        icon={Zap}
        title="Pulse Pressure"
        value={`${pulsePressure}`}
        unit="mmHg"
        statusLabel={ppStatus.label}
        statusColor={ppStatus.color}
        accentColor="#eab308"
        isActive={isPinned || activeHotspot === "pp"}
        isPinned={isPinned}
        onTogglePin={() => onTogglePinHotspot("pp")}
        onHover={() => onHoverHotspot("pp")}
        onLeave={onLeaveHotspot}
      />

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
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex flex-col gap-1.5">
        {riskTier && (
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border shadow-2xs backdrop-blur-md transition-all duration-200"
            style={{
              color: riskColor,
              borderColor: `${riskColor}50`,
              background: `${riskColor}15`,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: riskColor }} />
            <span className="text-[11px] font-semibold tracking-tight">
              {shapeCue.symbol} {tier} · 365d Complication Signal
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--glass-border)] shadow-xs w-fit">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              activeHotspot || isPinned ? "bg-emerald-400 animate-ping" : "bg-sky-400"
            }`}
          />
          <span className="text-[9px] font-mono text-[var(--text-muted)]">
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
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* Pin Vitals Toggle Button */}
        <button
          type="button"
          onClick={handleTogglePinAll}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold transition cursor-pointer border backdrop-blur-md shadow-xs flex items-center gap-1.5 ${
            isPinned
              ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
              : "bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--glass-border)] hover:text-[var(--text-primary)]"
          }`}
          title={isPinned ? "Unpin vitals markers" : "Pin all vitals markers visible"}
        >
          <Pin className={`w-3 h-3 ${isPinned ? "rotate-45 text-cyan-400" : ""}`} />
          <span>{isPinned ? "Pinned" : "Pin Vitals"}</span>
        </button>

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

        <div className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] px-2 py-1 rounded-lg border border-[var(--glass-border)] backdrop-blur-md hidden sm:block">
          Drag to rotate · Scroll to zoom
        </div>
      </div>

      {/* -- Bottom Docked Compact Vitals Telemetry Bar (Ultra-slim, never blocks legs) -- */}
      <div className="absolute bottom-2.5 inset-x-2.5 sm:inset-x-6 z-20 pointer-events-auto">
        <div className="p-1 sm:p-1.5 rounded-xl bg-slate-950/80 dark:bg-slate-950/90 backdrop-blur-md border border-white/10 shadow-lg grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {/* 1. Heartbeat */}
          <button
            type="button"
            onClick={() => handleTogglePinHotspot("heart")}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left ${
              activeHotspot === "heart"
                ? "border-rose-500/60 bg-rose-500/10"
                : "border-white/5 hover:border-rose-500/30"
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500/40 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[8px] font-mono uppercase text-slate-400">Heart Rate</span>
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                {currentHr} <span className="text-[8px] text-slate-400 font-normal">bpm</span>
                <span
                  className="w-1.5 h-1.5 rounded-full ml-auto"
                  style={{ backgroundColor: hrStatus.color }}
                />
              </span>
            </div>
          </button>

          {/* 2. Blood Pressure */}
          <button
            type="button"
            onClick={() => handleTogglePinHotspot("bp")}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left ${
              activeHotspot === "bp"
                ? "border-cyan-500/60 bg-cyan-500/10"
                : "border-white/5 hover:border-cyan-500/30"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[8px] font-mono uppercase text-slate-400">Blood Pressure</span>
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                {currentSbp}/{currentDbp}
                <span
                  className="text-[7.5px] font-mono px-1 rounded ml-auto"
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
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left ${
              activeHotspot === "pp"
                ? "border-amber-400/60 bg-amber-400/10"
                : "border-white/5 hover:border-amber-400/30"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[8px] font-mono uppercase text-slate-400">Pulse Pressure</span>
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                {currentPulsePressure} <span className="text-[8px] text-slate-400 font-normal">mmHg</span>
                <span
                  className="text-[7.5px] font-mono px-1 rounded ml-auto"
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
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/5 border transition cursor-pointer text-left ${
              activeHotspot === "bmi"
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-white/5 hover:border-amber-500/30"
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[8px] font-mono uppercase text-slate-400">BMI</span>
              <span className="text-xs font-mono font-bold text-white flex items-center gap-1">
                {currentBmi.toFixed(1)} <span className="text-[8px] text-slate-400 font-normal">kg/m²</span>
                <span
                  className="text-[7.5px] font-mono px-1 rounded ml-auto"
                  style={{ color: bmiStatus.color, backgroundColor: `${bmiStatus.color}20` }}
                >
                  {bmiStatus.label}
                </span>
              </span>
            </div>
          </button>
        </div>
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
          heartbeat={currentHr}
          bp={{ sbp: currentSbp, dbp: currentDbp }}
          bmiVal={currentBmi}
          pulsePressure={currentPulsePressure}
          hrStatus={hrStatus}
          bpStatus={bpStatus}
          bmiStatus={bmiStatus}
          ppStatus={ppStatus}
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

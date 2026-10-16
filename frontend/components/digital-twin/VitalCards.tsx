"use client";

import React from "react";
import { VitalSigns } from "@/lib/api";
import { formatVital } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import { Activity, Heart, Scale, Gauge, Droplet } from "lucide-react";

interface VitalCardsProps {
  vitals: VitalSigns;
  sparklineSbp?: number[];
  asOfDate?: string;
}

export function VitalCards({ vitals, sparklineSbp = [], asOfDate }: VitalCardsProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const sbp = vitals.sbp ?? 120;
  const dbp = vitals.dbp ?? 80;
  const bmi = vitals.bmi ?? 24.5;
  const hr = vitals.hr ?? 72;
  const weight = vitals.weight ?? 70;
  const pulsePressure = vitals.pulse_pressure ?? (sbp - dbp);
  const glucose = vitals.glucose;
  const hba1c = vitals.hba1c;

  // Clinical categorization with theme-aware glass badge styling
  const getBpCategory = (s: number, d: number) => {
    if (s >= 140 || d >= 90) {
      return {
        label: "Stage 2 HTN",
        class: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
      };
    }
    if (s >= 130 || d >= 80) {
      return {
        label: "Stage 1 HTN",
        class: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
      };
    }
    if (s >= 120) {
      return {
        label: "Elevated",
        class: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
      };
    }
    return {
      label: "Normal",
      class: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    };
  };

  const getBmiCategory = (b: number) => {
    if (b >= 30) {
      return {
        label: "Obese (Class 1+)",
        class: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30",
      };
    }
    if (b >= 25) {
      return {
        label: "Overweight",
        class: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
      };
    }
    if (b >= 18.5) {
      return {
        label: "Normal Weight",
        class: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      };
    }
    return {
      label: "Underweight",
      class: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
    };
  };

  const bpCat = getBpCategory(sbp, dbp);
  const bmiCat = getBmiCategory(bmi);

  const sparklineStroke = isDark ? "#60A5FA" : "#2563EB";

  // Generate mini SVG sparkline
  const renderSparkline = (points: number[]) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points) - 2;
    const max = Math.max(...points) + 2;
    const range = max - min || 1;
    const width = 84;
    const height = 24;
    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
        <polyline
          fill="none"
          stroke={sparklineStroke}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(" ")}
        />
        <circle
          cx={coords[coords.length - 1].split(",")[0]}
          cy={coords[coords.length - 1].split(",")[1]}
          r="3"
          fill={sparklineStroke}
        />
      </svg>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[var(--color-primary)]" />
          <span>Current Clinical State</span>
        </h3>
        {asOfDate && (
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            As of: <span className="text-[var(--text-primary)] font-medium">{asOfDate}</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 min-[440px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Blood Pressure Hero Card */}
        <div className="glass-card p-3.5 sm:p-4 min-[440px]:col-span-2 sm:col-span-1 border border-[var(--glass-border)] hover:border-[var(--color-primary)]/40 transition-all">
          <div className="flex items-start justify-between gap-1 flex-wrap">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Blood Pressure</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bpCat.class}`}>
              {bpCat.label}
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] tabular-nums">
              {Math.round(sbp)}/{Math.round(dbp)}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">mmHg</span>
          </div>
          <div className="mt-3.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">365d Trend</span>
            {renderSparkline(sparklineSbp.length > 0 ? sparklineSbp : [sbp - 4, sbp - 2, sbp + 2, sbp])}
          </div>
        </div>

        {/* Heart Rate Card */}
        <div className="glass-card p-3.5 sm:p-4 border border-[var(--glass-border)] hover:border-rose-500/40 transition-all">
          <div className="flex items-start justify-between gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Resting HR
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">Clinical</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] tabular-nums">
              {Math.round(hr)}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">bpm</span>
          </div>
          <div className="mt-3.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Target range</span>
            <span className="font-mono text-[var(--text-secondary)] font-medium">60–100 bpm</span>
          </div>
        </div>

        {/* BMI & Weight Card */}
        <div className="glass-card p-3.5 sm:p-4 border border-[var(--glass-border)] hover:border-cyan-500/40 transition-all">
          <div className="flex items-start justify-between gap-1 flex-wrap">
            <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[var(--color-secondary)]" />
              BMI & Weight
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bmiCat.class}`}>
              {bmiCat.label}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-1 sm:gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] tabular-nums">
              {formatVital(bmi, "", 1)}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">kg/m²</span>
            <span className="text-xs text-[var(--text-muted)] sm:ml-auto font-mono">
              ({formatVital(weight, "kg", 1)})
            </span>
          </div>
          <div className="mt-3.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Normal range</span>
            <span className="font-mono text-[var(--text-secondary)] font-medium">18.5–24.9</span>
          </div>
        </div>

        {/* Pulse Pressure Card */}
        <div className="glass-card p-3.5 sm:p-4 border border-[var(--glass-border)] hover:border-blue-500/40 transition-all">
          <div className="flex items-start justify-between gap-1">
            <span className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              Pulse Pressure
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">SBP - DBP</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[var(--text-primary)] tabular-nums">
              {Math.round(pulsePressure)}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">mmHg</span>
          </div>
          <div className="mt-3.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Arterial stiffness</span>
            <span className="font-mono text-[var(--text-secondary)] font-medium">
              {pulsePressure > 50 ? "Elevated (>50)" : "Normal (≤50)"}
            </span>
          </div>
        </div>
      </div>

      {/* Metabolic Labs strip (if present) */}
      {(glucose != null || hba1c != null) && (
        <div className="glass-panel px-3 sm:px-4 py-2.5 border border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <Droplet className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-semibold text-[var(--text-primary)]">Metabolic Markers:</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-[11px]">
            {glucose != null && (
              <span>
                Fasting Glucose: <strong className="text-[var(--text-primary)]">{glucose.toFixed(1)} mg/dL</strong>
              </span>
            )}
            {hba1c != null && (
              <span>
                HbA1c: <strong className="text-[var(--text-primary)]">{hba1c.toFixed(1)}%</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

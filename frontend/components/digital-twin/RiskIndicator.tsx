"use client";

import { RiskTier, RISK_BG, RISK_COLORS } from "@/lib/types";

interface RiskIndicatorProps {
  riskScore: number | null;
  riskTier: RiskTier | null;
  loading?: boolean;
  horizonDays?: number;
  calibrationNote?: string;
}

function RiskBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden mt-2">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background:
            pct >= 40
              ? "linear-gradient(90deg, #f59e0b, #ef4444)"
              : pct >= 15
              ? "linear-gradient(90deg, #22c55e, #f59e0b)"
              : "#22c55e",
        }}
      />
    </div>
  );
}

export default function RiskIndicator({
  riskScore,
  riskTier,
  loading,
  horizonDays = 365,
  calibrationNote,
}: RiskIndicatorProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-16 bg-slate-700 rounded animate-pulse" />
      </div>
    );
  }

  if (riskScore == null || riskTier == null) {
    return (
      <div className="text-slate-500 text-sm">No prediction yet</div>
    );
  }

  const tierLabels: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    Low: "Low",
    Moderate: "Moderate",
    High: "High",
  };

  return (
    <div>
      {/* Main tier badge */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className={`px-3 py-1.5 rounded-lg border font-bold text-lg tracking-wide ${RISK_BG[riskTier]}`}
        >
          {tierLabels[riskTier]}
        </div>
        <div className="text-slate-400 text-sm leading-tight">
          <div className="font-medium text-white text-base">MODEL RISK</div>
          <div className="text-[10px] text-slate-500">
            {horizonDays}-day hypertension risk signal
          </div>
        </div>
      </div>

      {/* Score bar */}
      <RiskBar score={riskScore} />

      {/* Secondary score */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest">
          Model score
        </span>
        <span className="font-mono text-sm text-slate-300 tabular-nums">
          {riskScore.toFixed(4)}
        </span>
      </div>

      {/* Calibration note */}
      <p className="mt-2 text-[10px] text-slate-600 italic leading-relaxed">
        {calibrationNote ??
          "Not a calibrated clinical probability. Research prototype using synthetic data."}
      </p>

      {/* Three-tier legend */}
      <div className="mt-3 flex gap-2">
        {(["LOW", "MEDIUM", "HIGH"] as RiskTier[]).map((t) => (
          <div
            key={t}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border
              ${riskTier === t ? RISK_BG[t] : "border-slate-700 text-slate-600"}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: RISK_COLORS[t] }}
            />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useCallback } from "react";
import { fetchWhatIf, WhatIfResponse } from "@/lib/api";
import { RISK_BADGE_CLASSES, RiskTier, normalizeTier } from "@/lib/types";
import { Sliders, RotateCcw, Sparkles, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";

interface WhatIfSimulatorProps {
  patientId: string | null;
  baselineScore: number | null;
  baselineTier: RiskTier | null;
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
        <span
          className={`text-xs font-mono font-bold tabular-nums px-2 py-0.5 rounded-md border ${
            value < 0
              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
              : value > 0
              ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30"
              : "text-[var(--text-muted)] bg-[var(--bg-subtle)] border-[var(--border-hairline)]"
          }`}
        >
          {value > 0 ? "+" : ""}
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 appearance-none rounded-full cursor-pointer bg-slate-200 dark:bg-slate-700/60 transition-all focus:outline-none"
        style={{
          background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${pct}%, rgba(148,183,220,0.2) ${pct}%, rgba(148,183,220,0.2) 100%)`,
        }}
      />
      <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
        <span>{min > 0 ? `+${min}` : min}{unit}</span>
        <span>0{unit}</span>
        <span>+{max}{unit}</span>
      </div>
    </div>
  );
}

function TierDelta({
  before,
  after,
}: {
  before?: string | null;
  after?: string | null;
}) {
  if (!before || !after) return null;

  const beforeNorm = normalizeTier(before);
  const afterNorm = normalizeTier(after);

  return (
    <div className="flex items-center gap-2 text-xs font-semibold">
      <span className={RISK_BADGE_CLASSES[beforeNorm]}>
        {beforeNorm}
      </span>
      <span className="text-[var(--text-muted)] font-mono">→</span>
      <span className={RISK_BADGE_CLASSES[afterNorm]}>
        {afterNorm}
      </span>
    </div>
  );
}

export default function WhatIfSimulator({
  patientId,
  baselineScore,
  baselineTier,
}: WhatIfSimulatorProps) {
  const [sbpDelta, setSbpDelta] = useState(0);
  const [weightPct, setWeightPct] = useState(0);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWhatIf(patientId, sbpDelta, weightPct / 100);
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Simulation failed to compute");
    } finally {
      setLoading(false);
    }
  }, [patientId, sbpDelta, weightPct]);

  const reset = () => {
    setSbpDelta(0);
    setWeightPct(0);
    setResult(null);
    setError(null);
  };

  if (!patientId) {
    return (
      <div className="glass-card p-6 text-center border border-[var(--glass-border)]">
        <p className="text-xs text-[var(--text-muted)]">Select a patient above to run counterfactual simulations.</p>
      </div>
    );
  }

  const changeStr =
    result
      ? `${result.change_pp > 0 ? "+" : ""}${result.change_pp.toFixed(1)} pp`
      : null;

  return (
    <div className="glass-panel p-5 border border-[var(--glass-border)] space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            Counterfactual What-If Simulator
          </h4>
        </div>
        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-[var(--color-primary)] border border-blue-500/20 font-semibold">
          FastAPI /api/what-if
        </span>
      </div>

      {/* Sliders */}
      <div className="space-y-2 pt-1">
        <Slider
          label="Systolic BP Delta"
          min={-20}
          max={20}
          step={1}
          value={sbpDelta}
          unit=" mmHg"
          onChange={setSbpDelta}
        />
        <Slider
          label="Body Weight Percentage Change"
          min={-10}
          max={10}
          step={1}
          value={weightPct}
          unit="%"
          onChange={setWeightPct}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={runSimulation}
          disabled={loading || (sbpDelta === 0 && weightPct === 0)}
          className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold glass-btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Simulating with ML Model…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Counterfactual Simulation</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={reset}
          title="Reset sliders"
          className="px-3.5 py-2 rounded-xl text-xs font-medium glass-btn-secondary flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {error && (
        <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 rounded-xl">
          {error}
        </div>
      )}

      {/* Simulation Result Comparison Card */}
      {result && (
        <div className="p-4 rounded-xl glass-card border border-[var(--glass-border)] animate-in fade-in duration-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Projected Model Risk Shift
            </span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                result.change_pp < 0
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  : result.change_pp > 0
                  ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30"
                  : "text-[var(--text-muted)] bg-[var(--bg-subtle)] border-[var(--border-hairline)]"
              }`}
            >
              {result.change_pp < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {changeStr}
            </span>
          </div>

          <TierDelta before={result.baseline_tier} after={result.simulated_tier} />

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-hairline)]">
            <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Baseline Score</div>
              <div className="font-mono text-base font-bold text-[var(--text-secondary)] tabular-nums mt-0.5">
                {result.baseline_score.toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--bg-subtle)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Simulated Score</div>
              <div className="font-mono text-base font-bold text-[var(--color-primary)] tabular-nums mt-0.5">
                {result.simulated_score.toFixed(4)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Required Honest Disclaimers */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Model simulation, not treatment advice.</span>
        </div>
        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
          Note: A model score change reflects statistical associations within the trained XGBoost model and does not establish a causal treatment effect.
        </p>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { ContributingFactor } from "@/lib/api";
import { TrendingUp, TrendingDown } from "lucide-react";

interface SHAPChartProps {
  factors: ContributingFactor[];
  isLoading?: boolean;
}

export function SHAPChart({ factors, isLoading = false }: SHAPChartProps) {
  if (isLoading) {
    return (
      <div className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
        <div className="h-4 bg-slate-300/40 dark:bg-slate-700/40 rounded-full w-1/3 animate-pulse" />
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 bg-slate-200/50 dark:bg-slate-800/50 rounded-md w-3/4 animate-pulse" />
              <div className="h-2 bg-slate-200/30 dark:bg-slate-800/30 rounded-full w-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!factors || factors.length === 0) {
    return (
      <div className="glass-card p-6 border border-[var(--glass-border)] text-center text-xs text-[var(--text-muted)]">
        No feature attribution available for this snapshot.
      </div>
    );
  }

  // Max absolute impact for proportional bar scaling
  const maxAbs = Math.max(...factors.map((f) => f.abs_impact), 0.05);

  return (
    <div className="glass-card p-5 border border-[var(--glass-border)] space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Explainability · Local Attributions
          </span>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            Key Contributing Drivers (SHAP)
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-2xs" />
            <span>Increases Risk</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-2xs" />
            <span>Reduces Risk</span>
          </span>
        </div>
      </div>

      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
        TreeExplainer attributions for this patient’s observation window. Positive values shift risk higher; negative values are protective.
      </p>

      {/* Horizontal Attribution Bars */}
      <div className="space-y-3 pt-1">
        {factors.map((factor, idx) => {
          const isIncrease = factor.impact > 0;
          const pctWidth = Math.min(100, Math.max(8, (factor.abs_impact / maxAbs) * 100));
          const barGradient = isIncrease
            ? "from-rose-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.35)]"
            : "from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.35)]";

          return (
            <div key={factor.feature + idx} className="space-y-1.5 group">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium text-[var(--text-primary)] min-w-0 flex items-center gap-1.5">
                  {isIncrease ? (
                    <TrendingUp className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                  )}
                  <span title={factor.feature} className="group-hover:text-[var(--color-primary)] transition-colors truncate">
                    {factor.label}
                  </span>
                  {factor.observed_value !== undefined && factor.observed_value !== null && (
                    <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                      ({factor.observed_value})
                    </span>
                  )}
                </span>
                <span
                  className={`font-mono text-xs font-bold tabular-nums ${
                    isIncrease ? "text-rose-600 dark:text-rose-400" : "text-cyan-600 dark:text-cyan-400"
                  }`}
                >
                  {isIncrease ? "+" : ""}
                  {factor.impact.toFixed(4)}
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-slate-200/50 dark:bg-slate-800/60 h-2.5 rounded-full overflow-hidden p-0.5 border border-[var(--glass-border)]">
                <div
                  className={`h-full bg-gradient-to-r ${barGradient} rounded-full transition-all duration-300`}
                  style={{ width: `${pctWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

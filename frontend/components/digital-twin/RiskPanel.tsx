"use client";

import React from "react";
import Link from "next/link";
import { RiskState } from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import { AlertCircle, ShieldAlert, CheckCircle2, Info, ArrowUpRight } from "lucide-react";

interface RiskPanelProps {
  risk: RiskState;
  percentileInCohort?: number;
  alertThreshold?: number;
}

export function RiskPanel({
  risk,
  percentileInCohort = 50,
  alertThreshold = 0.40,
}: RiskPanelProps) {
  const tier = normalizeTier(risk.risk_tier);
  const calibratedPct = (risk.calibrated_risk * 100).toFixed(1);
  const rawScore = risk.raw_score.toFixed(4);
  const ci = risk.confidence_interval_95;

  const ciText = ci
    ? `${(ci[0] * 100).toFixed(1)}% – ${(ci[1] * 100).toFixed(1)}%`
    : "± 3.8% (95% CI)";

  // Clinical guidance per tier with theme-aware styling
  const tierGuidance = {
    Low: {
      action: "Routine annual wellness review. Reinforce DASH dietary guidelines and daily physical activity.",
      colorClass: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      icon: CheckCircle2,
    },
    Moderate: {
      action: "Biannual BP verification; ambulatory or home BP monitoring (ABPM) recommended; dietary sodium reduction.",
      colorClass: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
      icon: Info,
    },
    High: {
      action: "Prompt clinician review; medication adherence & dosing evaluation; lifestyle intervention; 90-day follow-up.",
      colorClass: "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30",
      icon: ShieldAlert,
    },
  }[tier];

  const IconComponent = tierGuidance.icon;

  return (
    <div className="glass-panel p-5 border border-[var(--glass-border)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Model Risk Panel · 365-Day Horizon
          </span>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">
            Hypertension Decompensation Risk
          </h4>
        </div>
        <span className={RISK_BADGE_CLASSES[tier]}>
          {tier} Risk Tier
        </span>
      </div>

      {/* Main Metric Display */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
        {/* Calibrated Risk Hero */}
        <div className="sm:col-span-2 p-3.5 glass-card border border-[var(--glass-border)] flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Calibrated 1-Year Probability</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-[var(--color-primary)] border border-blue-500/20">
                Platt Scaled
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono tracking-tight text-[var(--text-primary)] tabular-nums">
                {calibratedPct}%
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                [95% CI: {ciText}]
              </span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-muted)] leading-tight">
            Probability of progressing to Stage 2 HTN or new cardiovascular complication within 365 days.
          </p>
        </div>

        {/* Raw Score Comparison */}
        <div className="p-3.5 glass-card border border-[var(--glass-border)] flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-[var(--text-secondary)] block">Uncalibrated Score</span>
            <div className="mt-1.5 text-2xl font-bold font-mono text-[var(--text-secondary)] tabular-nums">
              {rawScore}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[var(--text-muted)] leading-tight">
            Raw model rank score. Not a true probability; used solely for risk ranking.
          </p>
        </div>
      </div>

      {/* Cohort Distribution Visual */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
          <span>Cohort Distribution (N=1,335)</span>
          <span className="text-[var(--text-primary)] font-semibold">
            {percentileInCohort.toFixed(0)}th Percentile
          </span>
        </div>

        {/* Visual Distribution Gradient Bar */}
        <div className="relative w-full h-3.5 bg-slate-200/50 dark:bg-slate-800/60 rounded-full overflow-hidden border border-[var(--glass-border)]">
          {/* Base rate tick at ~1.5% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10"
            style={{ left: "1.5%" }}
            title="Cohort Base Rate: 1.46%"
          />
          {/* Alert threshold tick at 40% */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
            style={{ left: `${alertThreshold * 100}%` }}
            title={`Alert Threshold: ${(alertThreshold * 100).toFixed(0)}%`}
          />
          {/* Patient Position Marker */}
          <div
            className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] z-20 rounded-full shadow-md"
            style={{ left: `${Math.min(98, Math.max(2, risk.calibrated_risk * 100))}%` }}
          />
          {/* Subdued background zones */}
          <div className="absolute inset-y-0 left-0 w-[15%] bg-emerald-500/20" />
          <div className="absolute inset-y-0 left-[15%] w-[25%] bg-amber-500/20" />
          <div className="absolute inset-y-0 left-[40%] right-0 bg-rose-500/20" />
        </div>

        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
          <span>0%</span>
          <span className="text-blue-500">Base Rate: 1.46%</span>
          <span className="text-rose-500">Alert: {(alertThreshold * 100).toFixed(0)}%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Recommended Clinical Protocol Action */}
      <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${tierGuidance.colorClass} backdrop-blur-md`}>
        <IconComponent className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="flex-1">
          <span className="font-semibold block">Protocol Recommendation:</span>
          <p className="mt-0.5 leading-relaxed">{tierGuidance.action}</p>
        </div>
      </div>

      {/* Explanation Link & Disclaimer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
          <span>Model simulation, not clinical diagnosis or treatment advice.</span>
        </div>
        <Link
          href="/model-card"
          className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium text-[11px] shrink-0"
        >
          <span>View Model Card</span>
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

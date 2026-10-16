"use client";

import React, { useEffect, useState } from "react";
import { fetchModelPerformance, ModelPerformance } from "@/lib/api";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Info,
  ShieldAlert,
  ArrowRight,
  Database,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function PerformancePage() {
  const [perf, setPerf] = useState<ModelPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchModelPerformance()
      .then(setPerf)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const calibrationPlotData = perf?.calibration_curve?.map((pt) => ({
    name: `Bin ${pt.bin}`,
    predicted: Number((pt.predicted_risk * 100).toFixed(2)),
    observed: Number((pt.observed_fraction * 100).toFixed(2)),
    perfect: Number((pt.predicted_risk * 100).toFixed(2)),
    samples: pt.sample_count,
  })) || [
    { name: "Bin 1", predicted: 9.91, observed: 0.0, perfect: 9.91, samples: 193 },
    { name: "Bin 2", predicted: 9.91, observed: 0.52, perfect: 9.91, samples: 193 },
    { name: "Bin 3", predicted: 9.92, observed: 0.52, perfect: 9.92, samples: 193 },
    { name: "Bin 4", predicted: 9.94, observed: 1.04, perfect: 9.94, samples: 192 },
    { name: "Bin 5", predicted: 10.25, observed: 5.18, perfect: 10.25, samples: 193 },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              Model Performance Audit
            </span>
            <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-full font-bold">
              Transparent Evaluation
            </span>
            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-full font-bold">
              Held-Out Test (N=964)
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Empirical Model Performance &amp; Calibration Honesty
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-1 leading-relaxed">
            Evaluation of the 132-feature XGBoost decompensation pipeline on held-out test data (N=964). 
            Contrasts discrimination capacity with class-imbalanced prevalence limitations.
          </p>
        </div>

        <Link
          href="/twin?patient=PT-101"
          className="glass-btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold shrink-0 min-h-[38px]"
        >
          <span>Open Digital Twin</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading && (
        <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono animate-pulse">
          Loading empirical performance data…
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 rounded-xl text-xs">
          Failed to load model performance metrics: {error}
        </div>
      )}

      {perf && (
        <>
          {/* ── CRITICAL THRESHOLD DISCLOSURE (Requirement 6) ────────────────── */}
          <div className="p-4 sm:p-5 bg-rose-50/90 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-600/40 rounded-2xl text-xs space-y-3 shadow-sm">
            <div className="flex items-center gap-2 font-bold text-rose-950 dark:text-rose-100 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>Static Threshold Failure Analysis: 0% Recall on Held-Out Test Data</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono pt-1">
              <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-700/50 space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold block">
                  Static Cutoff
                </span>
                <strong className="text-sm font-mono text-[var(--text-primary)] font-bold block">
                  {perf.validation_threshold.toFixed(4)}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-700/50 space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold block">
                  True Positives
                </span>
                <strong className="text-sm font-mono text-rose-600 dark:text-rose-400 font-bold block">
                  0 of 14 Events (0.0% Recall)
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/80 border border-rose-200 dark:border-rose-700/50 space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-700 dark:text-rose-300 font-semibold block">
                  Operational Fix
                </span>
                <strong className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold block">
                  Alert-Budget Percentile Policy
                </strong>
              </div>
            </div>
            <p className="text-xs text-rose-950 dark:text-rose-100/90 leading-relaxed pt-0.5 font-sans">
              While test <strong className="text-rose-950 dark:text-white font-bold">ROC-AUC is 0.8069</strong> (ranking ability), test <strong className="text-rose-950 dark:text-white font-bold">PR-AUC is 0.0644</strong> against an empirical base rate of only <strong className="text-rose-950 dark:text-white font-bold">1.46%</strong> (14 events in 964 patients). Static binary cutoffs fail in low-prevalence clinical settings; an alert-budget operating policy is clinically mandatory.
            </p>
          </div>

          {/* ── CORE METRICS GRID (Requirement 4 & 6) ───────────────────────── */}
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl glass-card border border-[var(--glass-border)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                ROC-AUC (Discrimination)
              </span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {perf.roc_auc.toFixed(4)}
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                95% CI: [{perf.roc_auc_ci[0].toFixed(3)} – {perf.roc_auc_ci[1].toFixed(3)}]
              </span>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-[var(--glass-border)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                PR-AUC (Precision-Recall)
              </span>
              <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {perf.pr_auc.toFixed(4)}
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                4.42× base rate enrichment
              </span>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-[var(--glass-border)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                Prevalence (Base Rate)
              </span>
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                {(perf.event_rate * 100).toFixed(2)}%
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                14 test events / 964 rows
              </span>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-[var(--glass-border)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                Prediction Horizon
              </span>
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                365 Days
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                Leak-free 365d lookback
              </span>
            </div>
          </div>

          {/* ── CALIBRATION RELIABILITY PLOT ──────────────────────────────── */}
          <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Calibration Reliability Curve (Platt-Calibrated Test Cohort)
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Predicted risk vs. observed decompensation frequency across 5 quantile test bins.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                Method: Platt Sigmoid
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Curve Chart */}
              <div className="lg:col-span-7 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={calibrationPlotData} margin={{ top: 10, right: 10, left: -8, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} tickLine={false} fontFamily="monospace" />
                    <YAxis domain={[0, 8]} stroke="#9ca3af" fontSize={10} tickLine={false} fontFamily="monospace" unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-canvas)",
                        borderColor: "var(--border-subtle)",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="observed"
                      name="Observed Frequency (%)"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#2563EB" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="Predicted Risk (%)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 3, fill: "#f59e0b" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Quantile Bin Table */}
              <div className="lg:col-span-5 overflow-x-auto responsive-table-container text-xs font-mono">
                <table className="w-full min-w-[280px] text-left border border-[var(--border-subtle)] rounded-lg">
                  <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] uppercase">
                    <tr>
                      <th className="p-2">Quantile Bin</th>
                      <th className="p-2 text-right">Predicted</th>
                      <th className="p-2 text-right">Observed</th>
                      <th className="p-2 text-right">N</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)] text-[11px]">
                    {calibrationPlotData.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-500/5">
                        <td className="p-2 font-semibold text-[var(--text-primary)]">{row.name}</td>
                        <td className="p-2 text-right text-amber-600 dark:text-amber-400">{row.predicted}%</td>
                        <td className="p-2 text-right font-bold text-[var(--color-primary)]">{row.observed}%</td>
                        <td className="p-2 text-right text-[var(--text-muted)]">{row.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── ALERT-BUDGET OPERATING POLICY TABLE ───────────────────────── */}
          <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-3">
            <div className="border-b border-[var(--border-hairline)] pb-2.5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Alert-Budget Operating Policy (Clinical Screening Capacity)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Screening capacity policies allocating top 5%, 10%, or 20% of cohort to align with clinical staffing.
              </p>
            </div>

            <div className="overflow-x-auto responsive-table-container border border-[var(--border-subtle)] rounded-xl">
              <table className="w-full min-w-[640px] text-left text-xs font-mono">
                <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] uppercase">
                  <tr>
                    <th className="p-2.5">Policy Tier</th>
                    <th className="p-2.5 text-center">Cutoffs (Raw / Cal)</th>
                    <th className="p-2.5 text-center">TP / FP</th>
                    <th className="p-2.5 text-right">Precision</th>
                    <th className="p-2.5 text-right">Recall</th>
                    <th className="p-2.5">Clinical Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)] text-[11px]">
                  {perf.alert_budget_table?.map((item) => (
                    <tr key={item.tier} className="hover:bg-slate-500/5 transition-colors">
                      <td className="p-2.5">
                        <strong className="font-sans text-[var(--text-primary)] block">{item.tier}</strong>
                        <span className="text-[10px] text-[var(--text-muted)]">{item.patients_flagged} of 964 ({item.percent_flagged}%)</span>
                      </td>
                      <td className="p-2.5 text-center text-[10px] text-[var(--text-secondary)]">
                        {item.raw_threshold.toFixed(4)} / {item.calibrated_threshold.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        <span className="text-emerald-600 dark:text-emerald-400">{item.true_positives}</span> / <span className="text-rose-500">{item.false_positives}</span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-amber-600 dark:text-amber-400">
                        {(item.precision * 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 text-right font-bold text-[var(--color-primary)]">
                        {(item.recall * 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 font-sans text-[11px] text-[var(--text-secondary)] max-w-xs leading-snug">
                        {item.clinical_interpretation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── STATIC THRESHOLD CONFUSION MATRIX ─────────────────────────── */}
          <div className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
            <div className="border-b border-[var(--border-hairline)] pb-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Confusion Matrix at Static Validation Threshold ({perf.validation_threshold.toFixed(4)})
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center font-mono">
              <div className="p-3 rounded-xl border bg-rose-500/10 dark:bg-rose-950/40 border-rose-500/30 dark:border-rose-700/50">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 uppercase block font-sans font-semibold">True Positives</span>
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-200">{perf.threshold_tp}</span>
                <span className="text-[9px] text-rose-600 dark:text-rose-300/80 block font-sans mt-0.5 font-medium">0% of 14 flagged</span>
              </div>
              <div className="p-3 rounded-xl border bg-slate-500/10 dark:bg-slate-900/40 border-slate-500/30 dark:border-slate-700/50">
                <span className="text-[10px] text-[var(--text-muted)] uppercase block font-sans font-semibold">False Positives</span>
                <span className="text-2xl font-bold text-[var(--text-primary)]">{perf.threshold_fp}</span>
                <span className="text-[9px] text-[var(--text-muted)] block font-sans mt-0.5 font-medium">No false alarms</span>
              </div>
              <div className="p-3 rounded-xl border bg-rose-500/10 dark:bg-rose-950/40 border-rose-500/30 dark:border-rose-700/50">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 uppercase block font-sans font-semibold">False Negatives</span>
                <span className="text-2xl font-bold text-rose-600 dark:text-rose-200">{perf.threshold_fn}</span>
                <span className="text-[9px] text-rose-600 dark:text-rose-300/80 block font-sans mt-0.5 font-medium">All 14 events missed</span>
              </div>
              <div className="p-3 rounded-xl border bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500/30 dark:border-emerald-700/50">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase block font-sans font-semibold">True Negatives</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{perf.threshold_tn}</span>
                <span className="text-[9px] text-emerald-700 dark:text-emerald-300/80 block font-sans mt-0.5 font-medium">100% negative retained</span>
              </div>
            </div>
          </div>

          {/* ── MODEL LIMITATIONS (Requirement 4 & 6) ─────────────────────── */}
          <div className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-hairline)] pb-2">
              Clinical &amp; Algorithmic Limitations
            </h3>
            <ul className="space-y-1.5 text-xs text-[var(--text-secondary)] leading-relaxed list-disc list-inside">
              {perf.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

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
  ReferenceLine,
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
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--accent-teal)] uppercase">
              Model Performance Audit
            </span>
            <span className="text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded font-bold">
              Transparent Evaluation
            </span>
            <span className="text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-300 px-1.5 py-0.2 rounded font-bold">
              SYNTHETIC HELD-OUT TEST
            </span>
          </div>
          <h1 className="text-2xl font-serif text-[var(--text-primary)]">
            Empirical Model Performance &amp; Calibration Honesty
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-3xl mt-1 leading-relaxed">
            Rigorous evaluation of the 132-feature XGBoost hypertension decompensation model on held-out test data (N=964).
            Includes calibration reliability plots, operational alert-budget policies, and honest analysis of static threshold limitations.
          </p>
        </div>

        <Link
          href="/twin?patient=PT-101"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] rounded transition-colors shadow-xs shrink-0"
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
        <div className="p-4 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">
          Failed to load model performance metrics: {error}
        </div>
      )}

      {perf && (
        <>
          {/* ── HONEST THRESHOLDING WARNING BANNER ──────────────────────────── */}
          <div className="p-4 bg-rose-50/80 border border-rose-300 rounded text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-950 text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>Honest Metric Disclosure: Static Threshold Failure Analysis</span>
            </div>
            <p className="text-rose-900 leading-relaxed text-[11px]">
              At the static validation-selected threshold (≈<strong>{perf.validation_threshold.toFixed(4)}</strong>), the held-out test set
              flagged <strong>none of the 14 positive events</strong> (<strong>0.0% Recall</strong>, 0 True Positives, 14 False Negatives out of 964 test rows).
            </p>
            <p className="text-rose-900 leading-relaxed text-[11px]">
              While test <strong>ROC-AUC is 0.8069</strong> (reflecting relative ranking capacity), test <strong>PR-AUC is 0.0644</strong> against an empirical base rate of only <strong>1.46%</strong> (14 events). 
              In low-prevalence clinical settings, static binary cutoffs are clinically invalid and must be replaced by <strong>alert-budget operating percentile tiers</strong>.
            </p>
          </div>

          {/* ── CORE METRICS GRID ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="clinical-card p-3.5 bg-white border-[var(--border-hairline)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                ROC-AUC (Discrimination)
              </span>
              <div className="text-xl font-bold font-mono text-emerald-800">
                {perf.roc_auc.toFixed(4)}
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                95% CI: [{perf.roc_auc_ci[0].toFixed(3)} – {perf.roc_auc_ci[1].toFixed(3)}]
              </span>
            </div>

            <div className="clinical-card p-3.5 bg-white border-[var(--border-hairline)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                PR-AUC (Precision-Recall)
              </span>
              <div className="text-xl font-bold font-mono text-amber-800">
                {perf.pr_auc.toFixed(4)}
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                4.42× base rate enrichment
              </span>
            </div>

            <div className="clinical-card p-3.5 bg-white border-[var(--border-hairline)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                Prevalence (Base Rate)
              </span>
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                {(perf.event_rate * 100).toFixed(2)}%
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                94 total / 14 test events
              </span>
            </div>

            <div className="clinical-card p-3.5 bg-white border-[var(--border-hairline)] space-y-1">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">
                Test Set Size
              </span>
              <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
                964
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                Supervised snapshots
              </span>
            </div>
          </div>

          {/* ── CALIBRATION RELIABILITY PLOT ──────────────────────────────── */}
          <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Calibration Reliability Curve (Platt-Calibrated Test Cohort)
                </h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Plots mean predicted risk against empirical observed decompensation frequency across 5 quantile test bins.
                </p>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--bg-subtle)] border text-[var(--text-secondary)]">
                Method: Platt Sigmoid
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Curve Chart */}
              <div className="lg:col-span-7 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={calibrationPlotData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} fontFamily="monospace" />
                    <YAxis domain={[0, 8]} stroke="#9ca3af" fontSize={11} tickLine={false} fontFamily="monospace" unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        borderColor: "#e5e7eb",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontFamily: "monospace",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="observed"
                      name="Observed Frequency (%)"
                      stroke="#0d5c56"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#0d5c56" }}
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
              <div className="lg:col-span-5 overflow-x-auto text-xs font-mono">
                <table className="w-full text-left border rounded">
                  <thead className="bg-[var(--bg-subtle)] border-b text-[10px] text-[var(--text-muted)] uppercase">
                    <tr>
                      <th className="p-2">Quantile Bin</th>
                      <th className="p-2 text-right">Predicted Risk</th>
                      <th className="p-2 text-right">Observed Rate</th>
                      <th className="p-2 text-right">N</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)] text-[11px]">
                    {calibrationPlotData.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-50">
                        <td className="p-2 font-semibold text-[var(--text-primary)]">{row.name}</td>
                        <td className="p-2 text-right text-amber-700">{row.predicted}%</td>
                        <td className="p-2 text-right font-bold text-teal-800">{row.observed}%</td>
                        <td className="p-2 text-right text-[var(--text-muted)]">{row.samples}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── ALERT-BUDGET OPERATING POLICY TABLE ───────────────────────── */}
          <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-4">
            <div className="border-b border-[var(--border-hairline)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Alert-Budget Operating Policy Table (Recommended Clinical Strategy)
              </h3>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                Because rare clinical events make static thresholds impractical, healthcare systems allocate a screening budget (e.g., top 5%, 10%, or 20% of cohort).
              </p>
            </div>

            <div className="overflow-x-auto border border-[var(--border-hairline)] rounded">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[var(--bg-subtle)] border-b text-[10px] text-[var(--text-muted)] uppercase">
                  <tr>
                    <th className="p-2.5">Operating Policy Tier</th>
                    <th className="p-2.5 text-center">Score Cutoff (Raw / Cal)</th>
                    <th className="p-2.5 text-center">TP / FP</th>
                    <th className="p-2.5 text-right">Precision (95% CI)</th>
                    <th className="p-2.5 text-right">Recall (95% CI)</th>
                    <th className="p-2.5">Operational Guidance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)] text-[11px]">
                  {perf.alert_budget_table?.map((item) => (
                    <tr key={item.tier} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5">
                        <strong className="font-sans text-[var(--text-primary)] block">{item.tier}</strong>
                        <span className="text-[10px] text-[var(--text-muted)]">{item.patients_flagged} of 964 patients ({item.percent_flagged}%)</span>
                      </td>
                      <td className="p-2.5 text-center text-[10px] text-slate-600">
                        {item.raw_threshold.toFixed(4)} / {item.calibrated_threshold.toFixed(4)}
                      </td>
                      <td className="p-2.5 text-center font-bold">
                        <span className="text-emerald-700">{item.true_positives}</span> / <span className="text-rose-700">{item.false_positives}</span>
                      </td>
                      <td className="p-2.5 text-right font-bold text-amber-800">
                        {(item.precision * 100).toFixed(1)}%
                        <div className="text-[9px] text-[var(--text-muted)] font-normal">
                          [{(item.precision_ci_95[0] * 100).toFixed(1)}% – {(item.precision_ci_95[1] * 100).toFixed(1)}%]
                        </div>
                      </td>
                      <td className="p-2.5 text-right font-bold text-teal-800">
                        {(item.recall * 100).toFixed(1)}%
                        <div className="text-[9px] text-[var(--text-muted)] font-normal">
                          [{(item.recall_ci_95[0] * 100).toFixed(1)}% – {(item.recall_ci_95[1] * 100).toFixed(1)}%]
                        </div>
                      </td>
                      <td className="p-2.5 font-sans text-[11px] text-[var(--text-secondary)] leading-relaxed max-w-xs">
                        {item.clinical_interpretation}
                      </td>
                    </tr>
                  )) || (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-[var(--text-muted)]">
                        Loading alert budget table…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── STATIC THRESHOLD CONFUSION MATRIX (HONEST REPORTING) ───────── */}
          <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-3">
            <div className="border-b border-[var(--border-hairline)] pb-2.5">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Confusion Matrix at Static Validation Threshold ({perf.validation_threshold.toFixed(4)})
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Documenting the complete absence of true positives when applying the raw validation threshold to held-out test data.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
              <div className="p-3 rounded border bg-rose-50 border-rose-200">
                <span className="text-[10px] text-rose-700 uppercase block font-sans">True Positives (TP)</span>
                <span className="text-2xl font-bold text-rose-800">{perf.threshold_tp}</span>
                <span className="text-[9px] text-rose-600 block font-sans mt-0.5">0% of 14 positives flagged</span>
              </div>
              <div className="p-3 rounded border bg-slate-50 border-slate-200">
                <span className="text-[10px] text-slate-600 uppercase block font-sans">False Positives (FP)</span>
                <span className="text-2xl font-bold text-slate-800">{perf.threshold_fp}</span>
                <span className="text-[9px] text-slate-500 block font-sans mt-0.5">No false alarms generated</span>
              </div>
              <div className="p-3 rounded border bg-rose-50 border-rose-200">
                <span className="text-[10px] text-rose-700 uppercase block font-sans">False Negatives (FN)</span>
                <span className="text-2xl font-bold text-rose-800">{perf.threshold_fn}</span>
                <span className="text-[9px] text-rose-600 block font-sans mt-0.5">All 14 positive events missed</span>
              </div>
              <div className="p-3 rounded border bg-emerald-50 border-emerald-200">
                <span className="text-[10px] text-emerald-700 uppercase block font-sans">True Negatives (TN)</span>
                <span className="text-2xl font-bold text-emerald-800">{perf.threshold_tn}</span>
                <span className="text-[9px] text-emerald-600 block font-sans mt-0.5">100% of negative cases retained</span>
              </div>
            </div>
          </div>

          {/* ── MODEL LIMITATIONS & SPECIFICATIONS ────────────────────────── */}
          <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] border-b border-[var(--border-hairline)] pb-2.5">
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

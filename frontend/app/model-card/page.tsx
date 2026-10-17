"use client";

import React, { useState, useEffect } from "react";
import { fetchModelInfo, ModelInfo } from "@/lib/api";
import {
  FileText,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  XCircle,
  Database,
  BarChart3,
  GitBranch,
  Cpu,
  Layers,
} from "lucide-react";

export default function ModelCardPage() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModelInfo()
      .then((data) => setModel(data))
      .catch((err) => console.error("Failed to load model metadata:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl py-2 pb-16">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="space-y-1.5 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Clinical Model Card
          </span>
          <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full font-bold">
            Version 1.0.0
          </span>
        </div>
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Model Card · 365-Day Hypertension Decompensation
        </h1>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Clinical model evaluation card documenting training provenance, Platt calibration, and operational limitations for VitalTwin.
        </p>
      </div>

      {/* ── AT A GLANCE SPECIFICATIONS ──────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
          <span className="text-[10px] text-[var(--text-muted)] font-mono block">Architecture</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">XGBoost Classifier</strong>
          <span className="text-[9px] text-[var(--text-muted)]">scikit-learn pipeline</span>
        </div>
        <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
          <span className="text-[10px] text-[var(--text-muted)] font-mono block">Lookback / Horizon</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">365d / 365d</strong>
          <span className="text-[9px] text-[var(--text-muted)]">Strict temporal barrier</span>
        </div>
        <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
          <span className="text-[10px] text-[var(--text-muted)] font-mono block">Calibration</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">Platt Scaling</strong>
          <span className="text-[9px] text-[var(--text-muted)]">Sigmoid empirical mapping</span>
        </div>
        <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
          <span className="text-[10px] text-[var(--text-muted)] font-mono block">Feature Space</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">132 Features</strong>
          <span className="text-[9px] text-[var(--text-muted)]">Schema fingerprint verified</span>
        </div>
      </section>

      {/* ── HONEST METRICS TABLE WITH 95% CIs ────────────────────────────── */}
      <section className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="font-editorial text-base font-bold text-[var(--text-primary)]">
            Held-Out Test Performance (N=964)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* ROC-AUC */}
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Test ROC-AUC</span>
            <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              0.8069
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
              95% CI: [0.691, 0.908]
            </span>
            <p className="mt-1 text-[10px] text-[var(--text-muted)] leading-tight">
              Relative ranking capacity across 964 test observations.
            </p>
          </div>

          {/* PR-AUC */}
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Test PR-AUC</span>
            <div className="mt-1 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              0.0644
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
              Base Prevalence: 1.457%
            </span>
            <p className="mt-1 text-[10px] text-[var(--text-muted)] leading-tight">
              Reflects 4.4× enrichment over random baseline under extreme imbalance.
            </p>
          </div>

          {/* Test Positives */}
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Sample Distribution</span>
            <div className="mt-1 text-2xl font-bold font-mono text-[var(--text-primary)]">
              14 / 964
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">
              14 Events in Held-Out Test
            </span>
            <p className="mt-1 text-[10px] text-[var(--text-muted)] leading-tight">
              Total cohort: 6,451 observations across 1,335 synthetic profiles.
            </p>
          </div>
        </div>
      </section>

      {/* ── INTENDED VS NOT INTENDED USE ─────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Intended Use */}
        <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <h3 className="font-editorial text-sm font-bold text-[var(--text-primary)]">Intended Applications</h3>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc list-inside leading-snug">
            <li>Surveillance demonstration of longitudinal digital twins in cardiovascular care.</li>
            <li>Stratifying ambulatory patients by 365-day decompensation trajectory.</li>
            <li>Scenario exploration of lifestyle modifications (sodium reduction, weight changes).</li>
            <li>Analyzing temporal observation patterns and TreeSHAP attributions.</li>
          </ul>
        </div>

        {/* Not Intended Use */}
        <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-2.5">
          <div className="flex items-center gap-2 text-rose-500">
            <XCircle className="w-4 h-4 shrink-0" />
            <h3 className="font-editorial text-sm font-bold text-[var(--text-primary)]">Out-of-Scope / Not Intended</h3>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc list-inside leading-snug">
            <li><strong>Autonomous diagnosis:</strong> Not a standalone medical diagnostic device.</li>
            <li><strong>Pharmacotherapy changes:</strong> What-if simulator is non-prescriptive.</li>
            <li><strong>Emergency triage:</strong> Not evaluated on acute hypertensive crisis cases.</li>
            <li><strong>Unvalidated deployment:</strong> Requires local prospective trials in India.</li>
          </ul>
        </div>
      </section>

      {/* ── KNOWN LIMITATIONS ────────────────────────────────────────────── */}
      <section className="glass-card p-5 border border-amber-500/25 bg-amber-500/5 space-y-3">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5 text-amber-700 dark:text-amber-400">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <h2 className="font-editorial text-base font-bold text-[var(--text-primary)]">Known Operational Limitations</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--text-secondary)]">
          <div className="p-3 rounded-xl glass-card border border-amber-500/20 space-y-1">
            <strong className="text-[var(--text-primary)] font-semibold block">1. Synthetic Training Data</strong>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Trained on Synthea synthetic EHR records reflecting US demographics. Does not reflect Indian socioeconomic or clinical cohorts.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-amber-500/20 space-y-1">
            <strong className="text-[var(--text-primary)] font-semibold block">2. Severe Class Imbalance</strong>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              1.46% event rate (14 events in test partition) leads to 0% recall at a static cutoff, requiring alert-budget percentile policies.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

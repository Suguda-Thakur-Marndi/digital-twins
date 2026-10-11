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
    <div className="space-y-8 max-w-4xl py-2">
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="space-y-2 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Clinical Machine Learning Documentation
          </span>
          <span className="text-[10px] font-mono text-[var(--accent-teal)] bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] px-1.5 py-0.2 rounded font-medium">
            Version 1.0.0
          </span>
        </div>
        <h1 className="font-editorial text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          Model Card · 365-Day Hypertension Decompensation Pipeline
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Standardized clinical model evaluation card detailing training provenance, temporal validation splits, honest calibration metrics, and known operational limitations for the TwinCare digital twin engine.
        </p>
      </div>

      {/* ── AT A GLANCE SPECIFICATIONS ──────────────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="clinical-card p-3 bg-white">
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Architecture</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">XGBoost Classifier</strong>
          <span className="text-[10px] text-[var(--text-muted)]">scikit-learn Pipeline</span>
        </div>
        <div className="clinical-card p-3 bg-white">
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Lookback / Horizon</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">365d / 365d</strong>
          <span className="text-[10px] text-[var(--text-muted)]">Strict anti-leakage window</span>
        </div>
        <div className="clinical-card p-3 bg-white">
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Calibration</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">Platt Scaling</strong>
          <span className="text-[10px] text-[var(--text-muted)]">Sigmoid on validation log-odds</span>
        </div>
        <div className="clinical-card p-3 bg-white">
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">Feature Space</span>
          <strong className="text-xs text-[var(--text-primary)] block mt-0.5">132 Features</strong>
          <span className="text-[10px] text-[var(--text-muted)]">Schema fingerprint verified</span>
        </div>
      </section>

      {/* ── HONEST METRICS TABLE WITH 95% CIs ────────────────────────────── */}
      <section className="clinical-card p-5 bg-white space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <BarChart3 className="w-4 h-4 text-[var(--accent-teal)]" />
          <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
            Empirical Test Performance Metrics
          </h2>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The held-out test split evaluated 961 patient observation windows spanning chronological dates from 2023-07-02 to 2025-10-10. All metrics reflect exact numbers from the artifact metadata with bootstrap confidence intervals.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ROC-AUC */}
          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Test ROC-AUC</span>
            <div className="mt-1 text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
              0.8069
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono block mt-0.5">
              95% CI: [0.691, 0.908]
            </span>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Wide CI due to low absolute positive events in test partition.
            </p>
          </div>

          {/* PR-AUC */}
          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Test PR-AUC</span>
            <div className="mt-1 text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
              0.0644
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono block mt-0.5">
              Baseline Prevalence: 1.457%
            </span>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Reflects extreme class imbalance (~4.4x improvement over random base rate).
            </p>
          </div>

          {/* Test Positives */}
          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Sample Counts</span>
            <div className="mt-1 text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
              14 / 961
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono block mt-0.5">
              14 True Positives in Test Set
            </span>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              Total supervised cohort: 6,451 observations across 1,335 patients.
            </p>
          </div>
        </div>
      </section>

      {/* ── INTENDED VS NOT INTENDED USE ─────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Intended Use */}
        <div className="clinical-card p-5 bg-white space-y-3">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-editorial text-base font-bold">Intended Applications</h3>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-disc list-inside leading-relaxed">
            <li>Research demonstration of longitudinal digital twin concepts in cardiovascular health.</li>
            <li>Stratifying ambulatory patients by 365-day decompensation risk trajectory to assist population health triage.</li>
            <li>Interactive scenario exploration of lifestyle modifications (dietary sodium reduction, weight management) for patient education.</li>
            <li>Investigating temporal EHR observation patterns and feature attributions via TreeExplainer SHAP.</li>
          </ul>
        </div>

        {/* Not Intended Use */}
        <div className="clinical-card p-5 bg-white space-y-3">
          <div className="flex items-center gap-2 text-rose-800">
            <XCircle className="w-5 h-5 text-rose-600" />
            <h3 className="font-editorial text-base font-bold">Out-of-Scope / Not Intended</h3>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 list-disc list-inside leading-relaxed">
            <li><strong>Autonomous diagnosis:</strong> Cannot be used as a standalone medical diagnostic system.</li>
            <li><strong>Prescription changes:</strong> Counterfactual what-if outputs do NOT constitute pharmacological advice.</li>
            <li><strong>Acute emergency triage:</strong> Not evaluated on hypertensive emergency or crisis presentations.</li>
            <li><strong>Direct clinical deployment in India:</strong> Requires formal prospective validation on Indian cohorts first.</li>
          </ul>
        </div>
      </section>

      {/* ── KNOWN LIMITATIONS (MANDATORY HONESTY) ────────────────────────── */}
      <section className="clinical-card p-5 bg-white space-y-3 border-amber-200">
        <div className="flex items-center gap-2 text-amber-900 border-b border-[var(--border-hairline)] pb-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-700" />
          <h2 className="font-editorial text-lg font-bold">Known Operational Limitations</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1">
            <strong className="text-[var(--text-primary)] block">1. Synthetic US-Centric Data</strong>
            <p>
              Trained on Synthea synthetic EHR records reflecting US demographics, ICD-10 coding styles, and prescription habits. Does not capture Indian socioeconomic, dietary, or clinical real-world patterns.
            </p>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1">
            <strong className="text-[var(--text-primary)] block">2. Low Absolute Event Incidence</strong>
            <p>
              Severe class imbalance (1.46% event rate, only 14 test positives) leads to wide confidence intervals for ROC-AUC (0.69 to 0.91) and sensitive precision-recall boundaries.
            </p>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1">
            <strong className="text-[var(--text-primary)] block">3. Decoupled Wearable Feeds</strong>
            <p>
              Continuous sensor streams (smartwatch heart rate, daily steps) are simulated demonstrations and decoupled from the XGBoost weights. The model only ingests discrete EHR visit observations.
            </p>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1">
            <strong className="text-[var(--text-primary)] block">4. Correlational Not Causal</strong>
            <p>
              What-If simulator shifts correlated statistical distributions; it does not infer biochemical causality or replace prospective randomized trial findings.
            </p>
          </div>
        </div>
      </section>

      {/* ── ROADMAP FOR INDIAN HEALTHCARE REFORM ──────────────────────────── */}
      <section className="clinical-card p-5 bg-white space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <GitBranch className="w-4 h-4 text-[var(--accent-teal)]" />
          <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
            Roadmap for Indian Healthcare Adaptation (Summit 2026)
          </h2>
        </div>

        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded bg-[var(--accent-teal)] text-white flex items-center justify-center font-mono font-bold shrink-0 text-xs">
              1
            </span>
            <div>
              <strong className="text-[var(--text-primary)] block">Integration with ABDM / ABHA Ecosystem</strong>
              <p className="mt-0.5">
                Ingest standardized FHIR bundles from the Ayushman Bharat Digital Mission (ABDM) Personal Health Record (PHR) infrastructure, enabling longitudinal twin tracking across public PHCs and private hospitals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded bg-[var(--accent-teal)] text-white flex items-center justify-center font-mono font-bold shrink-0 text-xs">
              2
            </span>
            <div>
              <strong className="text-[var(--text-primary)] block">Validation on Indian Epidemiology (ICMR / AIIMS Cohorts)</strong>
              <p className="mt-0.5">
                Retrain and prospectively validate the model against ICMR-INDIAB and domestic hospital registries to calibrate baseline prevalence and specific cardiovascular risk factors (e.g. early onset in young Indian adults).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded bg-[var(--accent-teal)] text-white flex items-center justify-center font-mono font-bold shrink-0 text-xs">
              3
            </span>
            <div>
              <strong className="text-[var(--text-primary)] block">Clinician-in-the-Loop Audit & CDSCO Compliance</strong>
              <p className="mt-0.5">
                Implement multi-physician second-opinion workflows and secure medical device regulatory compliance with Central Drugs Standard Control Organisation (CDSCO) standards.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

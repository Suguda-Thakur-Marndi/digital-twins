"use client";

import React from "react";
import Link from "next/link";
import {
  Layers,
  Database,
  Cpu,
  BarChart2,
  Sliders,
  ShieldCheck,
  Activity,
  ArrowRight,
  GitBranch,
} from "lucide-react";

const STEPS = [
  {
    n: "01",
    title: "Longitudinal Synthetic EHR Data",
    desc: "Multi-year patient records containing encounters, vitals, laboratory tests, diagnoses, and medication statements generated via Synthea.",
    detail:
      "Each patient trajectory contains multiple timestamped observation snapshots spanning months to years, preserving clinical history.",
  },
  {
    n: "02",
    title: "365-Day Rolling Lookback Aggregation",
    desc: "For each prediction snapshot, historical clinical events from the preceding 365 days are aggregated into statistical summaries.",
    detail:
      "Captures trajectory slopes, pulse pressure variations, and recency rather than isolated, cross-sectional point readings.",
  },
  {
    n: "03",
    title: "132-Feature Clinical Representation",
    desc: "Rigorous tabular extraction across hemodynamics, anthropometrics, metabolic labs, encounter intensity, and medication history.",
    detail:
      "All 132 features conform to a strict schema fingerprint with clamped physiological bounds and forbidden target leakage columns enforced.",
  },
  {
    n: "04",
    title: "XGBoost Classification & Platt Scaling",
    desc: "Gradient boosted decision trees compute raw logit scores, subsequently Platt-calibrated to empirical event frequencies.",
    detail:
      "Calibrated probabilities prevent raw machine logits from masquerading as clinical certainty. 95% confidence intervals bound every prediction.",
  },
  {
    n: "05",
    title: "TreeSHAP Local Explainability",
    desc: "Decomposes each individual patient's score into exact feature contributions with clinical directionality.",
    detail:
      "Translates complex tree ensemble splits into human-readable clinical drivers (e.g., elevated lookback DBP, encounter cadence).",
  },
  {
    n: "06",
    title: "Full Digital Twin Simulator (Correlated Levers)",
    desc: "Interactive counterfactual simulator adjusting hemodynamics, metabolic labs, conditions, and 132 advanced features.",
    detail:
      "Lever map architecture ensures changing systolic BP automatically updates mean, max, and pulse pressure columns concurrently.",
  },
  {
    n: "07",
    title: "Simulated Wearable Telemetry & Early Warning",
    desc: "7-day rolling continuous telemetry stream (HR, home BP, steps, SpO2) coupled with lead-time early warning detection.",
    detail:
      "Clearly labeled SIMULATED layer with automated rule engines (e.g., home SBP ≥ 140 on 5 of 7 days) detecting alerts before decompensation.",
  },
];

const ARCH = [
  { layer: "Presentation Tier (Next.js 16 + React 19)", desc: "Calm editorial clinical dashboard, accessible contrast, i18n in English, Hindi, and Kannada." },
  { layer: "API & Validation Tier (FastAPI)", desc: "Pydantic contract enforcement, input distribution clamping, and cryptographic audit hashing." },
  { layer: "Cryptographic Audit Log", desc: "Append-only SHA-256 hash-chaining linking every inference from genesis to head." },
  { layer: "ML Pipeline & Calibration", desc: "132-feature XGBoost pipeline loaded from artifacts, Platt calibrator, TreeSHAP explainer." },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--accent-teal)] uppercase">
              Architecture &amp; Methodology
            </span>
            <span className="text-[10px] font-mono bg-[var(--accent-teal-subtle)] text-[var(--accent-teal)] border border-[var(--accent-teal-border)] px-1.5 py-0.2 rounded font-bold">
              7-Stage Digital Twin Pipeline
            </span>
          </div>
          <h1 className="text-2xl font-serif text-[var(--text-primary)]">
            How Pramana Clinical Twin Works
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-3xl mt-1 leading-relaxed">
            From longitudinal EHR aggregation and 132-feature engineering to XGBoost inference,
            Platt calibration, and real-time counterfactual simulation.
          </p>
        </div>

        <Link
          href="/twin?patient=PT-101"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] rounded transition-colors shadow-xs shrink-0"
        >
          <span>Launch Simulator</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── 7-STAGE PIPELINE CARDS ────────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-bold text-[var(--text-primary)]">
          Clinical Digital Twin Pipeline
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-2 relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--accent-teal)]">
                  STAGE {step.n}
                </span>
                <span className="w-6 h-6 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)] text-[10px] font-mono font-bold flex items-center justify-center">
                  {step.n}
                </span>
              </div>
              <h3 className="font-serif text-base font-bold text-[var(--text-primary)]">
                {step.title}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {step.desc}
              </p>
              <div className="text-[11px] text-[var(--text-muted)] border-t border-[var(--border-hairline)] pt-2 leading-relaxed">
                {step.detail}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FULL SYSTEM ARCHITECTURE ──────────────────────────────────────── */}
      <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] space-y-4">
        <div className="border-b border-[var(--border-hairline)] pb-3">
          <h2 className="font-serif text-lg font-bold text-[var(--text-primary)]">
            Full System Architecture Layers
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Strict separation between client presentation, backend orchestration, and model inference.
          </p>
        </div>

        <div className="space-y-2.5">
          {ARCH.map((item, idx) => (
            <div
              key={idx}
              className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs"
            >
              <strong className="text-[var(--text-primary)] font-mono text-xs">{item.layer}</strong>
              <span className="text-[var(--text-secondary)] text-[11px]">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

const FLOW_STEPS = [
  {
    step: "01",
    label: "EHR Data",
    desc: "Longitudinal encounters, lab panels & Bluetooth cuff streams",
  },
  {
    step: "02",
    label: "Patient State",
    desc: "132 rolling features aggregated over 365-day lookback",
  },
  {
    step: "03",
    label: "XGBoost Model",
    desc: "Gradient boosted tree classifier evaluated on held-out test set",
  },
  {
    step: "04",
    label: "Risk Estimate",
    desc: "Platt-calibrated 365-day probability with 95% confidence intervals",
  },
  {
    step: "05",
    label: "SHAP Explanation",
    desc: "Signed TreeExplainer attribution & correlated what-if counterfactuals",
  },
];

const PIPELINE_STAGES = [
  {
    num: "01",
    title: "Multi-Source Longitudinal Ingestion",
    highlight: "Ambulatory visits + Labs + Peripheral Cuffs",
    points: [
      "Aggregates multi-year encounters without future target leakage.",
      "Supports low-cost Bluetooth oscillometric cuffs (Omron, Dr. Morepen).",
      "Standardized ABDM FHIR R4 bundle ingestion (Patient, Observation).",
    ],
  },
  {
    num: "02",
    title: "132-Feature State Representation",
    highlight: "Strict Schema Fingerprint: a4ddaedb",
    points: [
      "Extracts rolling mean, variance, min, max, and trajectory slopes.",
      "Computes pulse pressure and metabolic ratios (Glucose, HbA1c, BMI).",
      "Clamped bounds and automatic target-leakage rejection.",
    ],
  },
  {
    num: "03",
    title: "XGBoost Inference & Platt Calibration",
    highlight: "Test ROC-AUC: 0.8069 · PR-AUC: 0.0644",
    points: [
      "Predicts 365-day progression to Stage 2 HTN (≥140/90 mmHg).",
      "Platt sigmoid calibrates raw tree logits to empirical frequencies.",
      "Accounts for severe class imbalance (1.46% test base rate).",
    ],
  },
  {
    num: "04",
    title: "TreeSHAP Local Explainability",
    highlight: "Exact Feature Directionality (+ / - Impact)",
    points: [
      "Decomposes every individual score into exact feature contributions.",
      "Identifies primary clinical drivers (e.g., lookback DBP, encounter gaps).",
      "Distinguishes protective factors from escalating risk indicators.",
    ],
  },
  {
    num: "05",
    title: "Correlated Counterfactual What-If Lab",
    highlight: "lever_map.json Clinical Coherence",
    points: [
      "Adjusting SBP simultaneously updates mean, max, and pulse pressure.",
      "Weight changes dynamically recompute BMI and metabolic levers.",
      "Pre-configured clinical presets (DASH diet, ACE-i, Sodium reduction).",
    ],
  },
];

const TIMELINE_MILESTONES = [
  {
    phase: "Phase 1: Ingestion",
    title: "Synthetic EHR Pipeline",
    status: "Completed",
    desc: "Synthea cohort generation (N=1,335, 6,451 observations), ABDM FHIR parser & leak-free 365d lookback temporal windowing.",
  },
  {
    phase: "Phase 2: Representation",
    title: "132-Feature Clinical Matrix",
    status: "Completed",
    desc: "Schema fingerprint verification, distribution bounds, pulse pressure derivation, and target leakage prevention.",
  },
  {
    phase: "Phase 3: Model & Calibration",
    title: "XGBoost + Platt Scaling",
    status: "Completed",
    desc: "Test ROC-AUC 0.8069, PR-AUC 0.0644, 5-bin calibration curve, and alert-budget operating policy table.",
  },
  {
    phase: "Phase 4: Explainability & Simulation",
    title: "SHAP & What-If Engine",
    status: "Completed",
    desc: "TreeExplainer integration, correlated lever mapping, sensitivity response curves, and 3-scenario comparison.",
  },
  {
    phase: "Phase 5: Governance",
    title: "Tamper-Evident Audit Chain",
    status: "Completed",
    desc: "Append-only SHA-256 cryptographic hash-chaining linking every inference from genesis to head.",
  },
];

const ARCH_LAYERS = [
  { layer: "Presentation (Next.js 16 + React 19)", tech: "TypeScript · Tailwind CSS · Turbopack · Lucide Icons" },
  { layer: "API & Validation Tier (FastAPI)", tech: "Pydantic V2 · Input Clamping · Dynamic Lever Shifting" },
  { layer: "ML & Calibration Runtime", tech: "scikit-learn 1.6 · XGBoost 2.0 · TreeSHAP · Joblib Pipeline" },
  { layer: "Audit & Integrity Engine", tech: "SHA-256 Hash-Chain · Merkle Linking · Zero PHI Storage" },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              Architecture &amp; Methodology
            </span>
            <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full font-bold">
              5-Step Flowchart
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            How Pramana Clinical Twin Operates
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-1 leading-relaxed">
            From raw longitudinal EHR records to 132-feature extraction, calibrated XGBoost inference, and interactive what-if counterfactuals.
          </p>
        </div>

        <Link
          href="/twin?patient=PT-101"
          className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold shrink-0"
        >
          <span>Launch Simulator</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── VISUAL FLOWCHART (Requirement 4) ─────────────────────────────── */}
      <section className="glass-card p-5 sm:p-6 border border-[var(--glass-border)] space-y-4">
        <div className="border-b border-[var(--border-hairline)] pb-2.5">
          <span className="text-[10px] font-mono text-[var(--color-primary)] uppercase tracking-wider font-bold">
            Data &amp; Inference Pipeline
          </span>
          <h2 className="text-base font-editorial font-bold text-[var(--text-primary)]">
            Visual Architecture Flowchart
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-center">
          {FLOW_STEPS.map((step, idx) => (
            <div
              key={step.step}
              className="p-3.5 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between relative"
            >
              <div>
                <span className="text-[10px] font-mono text-[var(--color-primary)] font-bold">
                  STEP {step.step}
                </span>
                <h3 className="font-semibold text-xs text-[var(--text-primary)] mt-1">
                  {step.label}
                </h3>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-tight">
                {step.desc}
              </p>
              {idx < FLOW_STEPS.length - 1 && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-[var(--text-muted)] font-bold text-xs">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 5 PIPELINE STAGES ────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-editorial font-bold text-[var(--text-primary)]">
          Clinical Engineering Stages
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {PIPELINE_STAGES.map((stage) => (
            <div
              key={stage.num}
              className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[var(--color-primary)]">
                  STAGE {stage.num}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                  {stage.highlight}
                </span>
              </div>
              <h3 className="font-editorial text-sm font-bold text-[var(--text-primary)]">
                {stage.title}
              </h3>
              <ul className="space-y-1 text-xs text-[var(--text-secondary)]">
                {stage.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 leading-snug">
                    <span className="text-[var(--color-primary)] text-xs mt-0.5">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── IMPLEMENTATION TIMELINE (Requirement 4) ──────────────────────── */}
      <section className="glass-card p-5 sm:p-6 border border-[var(--glass-border)] space-y-4">
        <div className="border-b border-[var(--border-hairline)] pb-2.5">
          <span className="text-[10px] font-mono text-[var(--color-primary)] uppercase tracking-wider font-bold">
            Project Trajectory
          </span>
          <h2 className="text-base font-editorial font-bold text-[var(--text-primary)]">
            Implementation &amp; Verification Milestones
          </h2>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--color-primary)]/30">
          {TIMELINE_MILESTONES.map((m, idx) => (
            <div key={idx} className="relative group">
              <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-[var(--color-primary)] border-2 border-white dark:border-slate-900 shadow-xs" />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">{m.title}</span>
                <span className="text-[10px] font-mono text-[var(--color-primary)] font-semibold">({m.phase})</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                  {m.status}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-relaxed">
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SYSTEM ARCHITECTURE LAYERS ──────────────────────────────────── */}
      <section className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
        <h2 className="text-sm font-editorial font-bold text-[var(--text-primary)]">
          System Architecture Layers
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {ARCH_LAYERS.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between"
            >
              <strong className="text-[var(--text-primary)] font-mono text-xs">{item.layer}</strong>
              <span className="text-[var(--text-muted)] text-[11px] font-mono mt-1">{item.tech}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

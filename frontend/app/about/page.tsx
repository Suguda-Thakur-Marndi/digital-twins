"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, HeartHandshake, Award, FileCode2, ExternalLink } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl py-2 pb-16">
      {/* Header */}
      <div className="space-y-1.5 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Governance &amp; Charter
          </span>
          <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full font-bold">
            Bengaluru 2026
          </span>
        </div>
        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          About VitalTwin · Responsible Clinical AI Charter
        </h1>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          A Living Digital Perspective on Health. Developed for the Happiest Health Summit 2026 under the theme <em>Digital Twin in Healthcare</em>.
        </p>
      </div>

      {/* ── RESPONSIBLE USE CHARTER ───────────────────────────────────────── */}
      <section className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
          <h2 className="font-editorial text-base font-bold text-[var(--text-primary)]">
            Clinical Humility &amp; Validation Principles
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--text-secondary)]">
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
            <strong className="text-[var(--text-primary)] font-semibold block">1. Transparent Imbalance Reporting</strong>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Reports test PR-AUC (0.0644) alongside ROC-AUC (0.8069) to reflect 1.46% base rate challenges and false positive risk.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
            <strong className="text-[var(--text-primary)] font-semibold block">2. Empirical Calibration</strong>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Platt scaling transforms raw tree logits into empirical frequencies; uncalibrated scores are never labeled as clinical odds.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
            <strong className="text-[var(--text-primary)] font-semibold block">3. 95% Uncertainty Intervals</strong>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Every inference provides bootstrap confidence intervals and cohort percentile stratification.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
            <strong className="text-[var(--text-primary)] font-semibold block">4. Explicit Telemetry Watermarking</strong>
            <p className="text-[11px] text-[var(--text-muted)] leading-snug">
              Wearable sensor feeds are explicitly flagged as simulated to avoid confusion with validated ambulatory signals.
            </p>
          </div>
        </div>
      </section>

      {/* ── DATA PRIVACY & TAMPER-EVIDENT SECURITY ────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <Lock className="w-4 h-4" />
            <h3 className="font-editorial text-sm font-bold text-[var(--text-primary)]">Privacy by Design</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            All profiles originate from Synthea synthetic EHR generation. Zero Protected Health Information (PHI) is stored. PII like names, IDs, and encounter dates are stripped before matrix ingestion.
          </p>
        </div>

        <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-2">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <FileCode2 className="w-4 h-4" />
            <h3 className="font-editorial text-sm font-bold text-[var(--text-primary)]">Tamper-Evident Auditability</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Every inference and counterfactual simulation executes through a logged endpoint writing timestamp, schema fingerprint, model version, and payload SHA-256 hash to an append-only JSONL chain.
          </p>
        </div>
      </section>

      {/* ── SUMMIT & TEAM ATTRIBUTION ─────────────────────────────────────── */}
      <section className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <Award className="w-4 h-4 text-amber-500" />
          <h2 className="font-editorial text-base font-bold text-[var(--text-primary)]">
            Summit Presentation Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
            <span className="text-[var(--text-muted)] block text-[10px]">Summit Track</span>
            <strong className="text-[var(--text-primary)] block text-xs">
              Happiest Health Summit 2026 · Bengaluru
            </strong>
            <span className="text-[10px] text-[var(--text-muted)]">Digital Twin in Healthcare Track</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
            <span className="text-[var(--text-muted)] block text-[10px]">Challenge Focus</span>
            <strong className="text-[var(--text-primary)] block text-xs">
              Longitudinal Prevention &amp; Intervention
            </strong>
            <span className="text-[10px] text-[var(--text-muted)]">Hypertension Decompensation Intelligence</span>
          </div>
        </div>

        <div className="pt-2 text-xs text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)]">
          <span>Project: <strong>VitalTwin — AI-Powered Clinical Digital Twin</strong></span>
          <div className="flex items-center gap-3">
            <Link href="/twin?patient=PT-101" className="text-[var(--color-primary)] hover:underline">
              Open Twin Dashboard →
            </Link>
            <Link href="/model-card" className="text-[var(--color-primary)] hover:underline">
              Model Card →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

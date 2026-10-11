"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, HeartHandshake, Award, FileCode2, ExternalLink } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-4xl py-2">
      {/* Header */}
      <div className="space-y-2 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Ethics, Governance & Summit Context
          </span>
          <span className="text-[10px] font-mono text-[var(--accent-teal)] bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] px-1.5 py-0.2 rounded font-medium">
            Bengaluru 2026
          </span>
        </div>
        <h1 className="font-editorial text-3xl font-bold text-[var(--text-primary)] tracking-tight">
          About TwinCare · Responsible Clinical AI Charter
        </h1>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          Developed for the Happiest Health "Reimagining and Reforming Healthcare in India Summit 2026" under the theme <em>Digital Twin in Healthcare</em>.
        </p>
      </div>

      {/* ── RESPONSIBLE USE CHARTER ───────────────────────────────────────── */}
      <section className="clinical-card p-6 bg-white space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <ShieldCheck className="w-5 h-5 text-[var(--accent-teal)]" />
          <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
            Responsible Use & Clinical Humility Statement
          </h2>
        </div>

        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>
            TwinCare is designed with clinical humility as an inviolable engineering principle. In an era of overhyped algorithmic claims, our platform adheres strictly to evidence-based AI hygiene:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong>No Exaggerated Predictive Power:</strong> We openly present our test PR-AUC of 0.064 alongside our 0.81 ROC-AUC, highlighting that predicting rare decompensation events (~1.46% base rate) yields meaningful false positives.
            </li>
            <li>
              <strong>No Uncalibrated Scores:</strong> Raw machine learning logits are never presented as clinical probabilities. All outputs are Platt-calibrated to reflect empirical empirical frequencies.
            </li>
            <li>
              <strong>Explicit Uncertainty Intervals:</strong> Every prediction is bound by a 95% confidence interval and compared visually to the broader synthetic cohort distribution.
            </li>
            <li>
              <strong>Clear Separation of Telemetry:</strong> Wearable streams are explicitly watermarked as simulated, preventing users from assuming unvalidated continuous sensor inputs drive the model.
            </li>
          </ul>
        </div>
      </section>

      {/* ── DATA PRIVACY & TAMPER-EVIDENT SECURITY ────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="clinical-card p-5 bg-white space-y-3">
          <div className="flex items-center gap-2 text-indigo-900">
            <Lock className="w-4 h-4 text-indigo-700" />
            <h3 className="font-editorial text-base font-bold">Privacy by Design</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            All records in this demonstration originate from Synthea synthetic EHR generators. No Protected Health Information (PHI) or real human identities exist within the repository. Input pipelines reject patient IDs, dates, and unneeded demographic metadata before inference.
          </p>
        </div>

        <div className="clinical-card p-5 bg-white space-y-3">
          <div className="flex items-center gap-2 text-[var(--accent-teal)]">
            <FileCode2 className="w-4 h-4" />
            <h3 className="font-editorial text-base font-bold">Tamper-Evident Auditability</h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Every inference and counterfactual simulation executes through a logged endpoint that writes the timestamp, schema fingerprint, model version, and an input payload SHA-256 hash to an append-only JSONL log.
          </p>
        </div>
      </section>

      {/* ── SUMMIT & TEAM ATTRIBUTION ─────────────────────────────────────── */}
      <section className="clinical-card p-6 bg-white space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <Award className="w-5 h-5 text-amber-600" />
          <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
            Summit Presentation Details
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1">
            <span className="text-[var(--text-muted)] block text-[11px]">Summit Event</span>
            <strong className="text-[var(--text-primary)] block text-xs">
              Reimagining and Reforming Healthcare in India Summit 2026
            </strong>
            <span className="text-[10px] text-[var(--text-muted)]">Happiest Health · Bengaluru, India</span>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1">
            <span className="text-[var(--text-muted)] block text-[11px]">Hackathon Track</span>
            <strong className="text-[var(--text-primary)] block text-xs">
              The Digital Twin in Healthcare
            </strong>
            <span className="text-[10px] text-[var(--text-muted)]">Longitudinal Prevention & Intervention</span>
          </div>
        </div>

        <div className="pt-2 text-xs text-[var(--text-muted)] flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)]">
          <span>Project Repository: <strong>TwinCare (Pramana Clinical Twin)</strong></span>
          <div className="flex items-center gap-3">
            <Link href="/twin?patient=PT-101" className="text-[var(--accent-teal)] hover:underline">
              Open Twin Dashboard →
            </Link>
            <Link href="/model-card" className="text-[var(--accent-teal)] hover:underline">
              Model Card →
            </Link>
          </div>
        </div>
      </section>
      {/* ── 3D HUMAN AVATAR ATTRIBUTION & PRIVACY NOTICE ───────────────── */}
      <section className="clinical-card p-6 bg-white space-y-4">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <HeartHandshake className="w-5 h-5 text-teal-600" />
          <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
            3D Body Model Attribution & Privacy Compliance
          </h2>
        </div>

        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>
            The 3D Human Body view utilizes an open-source, generic humanoid rigged avatar to project spatialized physiological vitals and counterfactual simulator projections.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">Model Name & File</span>
              <strong>Generic Rigged Humanoid (generic-body.glb / Xbot)</strong>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">Model Author & Source</span>
              <span>Three.js Authors & Contributors (mrdoob/three.js)</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">License</span>
              <strong className="text-emerald-700">MIT License (Open-Source Reuse Permitted)</strong>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px]">File Size & Optimization</span>
              <span>2.79 MB (under 5 MB budget, high-performance R3F GLTF)</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-900 text-[11px] space-y-1">
            <strong>Mandatory Legal & Privacy Protections:</strong>
            <p>
              • <strong>Synthetic Patient, Generic Model:</strong> The 3D model depicts no real, named individual. Facial features are non-identifiable and generic.
            </p>
            <p>
              • <strong>Illustrative body model:</strong> It does not represent this patient&apos;s anatomy. It is an interactive clinical interface for mapped telemetry, not an anatomical or radiological diagnostic image.
            </p>
            <p>
              • <strong>Attributions documentation:</strong> Full licensing and bone rig mapping topology are recorded in <code>docs/ATTRIBUTIONS.md</code>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

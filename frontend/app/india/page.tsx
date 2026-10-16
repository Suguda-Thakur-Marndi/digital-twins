"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  ShieldAlert,
  Users,
  Smartphone,
  ArrowRight,
  Database,
  Building2,
  CheckCircle2,
  Info,
} from "lucide-react";

const STATS = [
  {
    value: "~220 Million",
    label: "Adults with Hypertension in India",
    source: "ICMR-INDIAB Study, Lancet 2023",
  },
  {
    value: "~25%",
    label: "Rural Treatment & Control Rate",
    source: "India Hypertension Control Initiative (IHCI) 2023",
  },
  {
    value: "1 in 5",
    label: "Global HTN-Attributable Deaths in India",
    source: "Global Burden of Disease (GBD), Lancet",
  },
  {
    value: "ABDM Aligned",
    label: "FHIR R4 Bundle Compatibility",
    source: "NHA ABDM Standards Framework 2023",
  },
];

const SECTIONS = [
  {
    icon: Activity,
    title: "1. PHC & Ayushman Arogya Mandir Triage",
    points: [
      "Flags escalating BP risk months before acute hypertensive crises occur.",
      "Empowers community screening triage at Health & Wellness Centres.",
    ],
    note: "Early risk detection before emergency hospital presentations.",
  },
  {
    icon: Smartphone,
    title: "2. Affordable Bluetooth Telemetry Ingestion",
    points: [
      "Supports low-cost oscillometric cuffs (Omron, Dr. Morepen, Beurer).",
      "Maintains continuous 7-day ambulatory rolling blood pressure averages.",
    ],
    note: "Aligned with IGH-IV out-of-office blood pressure variability guidelines.",
  },
  {
    icon: Database,
    title: "3. ABDM FHIR Standards Framework",
    points: [
      "Parses standardized ABDM FHIR R4 Bundles (Patient, Observation, Condition).",
      "Maps ABHA health account records directly into 132-feature vector.",
    ],
    note: "Interoperable health data exchange across public and private care tiers.",
  },
  {
    icon: Users,
    title: "4. Frontline Worker (ASHA / ANM) Decision Support",
    points: [
      "Plain-language patient summaries avoiding complex algorithmic jargon.",
      "Available with multi-lingual localization support.",
    ],
    note: "Assists home visits and rural outreach health workers.",
  },
  {
    icon: ShieldAlert,
    title: "5. Clinical Validation Requirements",
    points: [
      "Prototype trained on synthetic EHR data (Synthea US demographics).",
      "Requires local trial validation before deployment on Indian populations.",
    ],
    note: "Must account for Indian 'thin-fat' metabolic phenotype and dietary sodium patterns.",
  },
];

export default function IndiaPage() {
  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              National Health Context
            </span>
            <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 px-2 py-0.5 rounded-full font-bold">
              Happiest Health Summit 2026 · Bengaluru
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Digital Twins for Hypertension in India
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-1 leading-relaxed">
            Cardiovascular risk surveillance for India&rsquo;s 220 million adults with hypertension, bridging Primary Health Centres, ABDM records, and home cuffs.
          </p>
        </div>

        <Link
          href="/import"
          className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold shrink-0 min-h-[38px]"
        >
          <span>Explore ABDM Ingestion</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── POPULATION LIMITATION DISCLOSURE ───────────────────────────────── */}
      <div className="p-3.5 rounded-xl glass-card bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Population Calibration Disclosure:</strong> Model trained on synthetic Synthea EHR. Not validated on Indian populations; not for clinical diagnosis or prescription in India today.
          </span>
        </div>
        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 shrink-0 self-end sm:self-auto">
          Research Prototype
        </span>
      </div>

      {/* ── SOURCED EPIDEMIOLOGY METRICS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
        {STATS.map((item, idx) => (
          <div key={idx} className="p-3.5 sm:p-4 rounded-xl glass-card border border-[var(--glass-border)] space-y-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-primary)] block">
              {item.value}
            </span>
            <span className="text-xs font-semibold text-[var(--text-secondary)] block">
              {item.label}
            </span>
            <div className="text-[9px] text-[var(--text-muted)] font-mono border-t border-[var(--border-hairline)] pt-1 mt-1 truncate">
              {item.source}
            </div>
          </div>
        ))}
      </div>

      {/* ── STRATEGIC PILLARS FOR INDIA ───────────────────────────────────── */}
      <div className="glass-card p-5 sm:p-6 border border-[var(--glass-border)] space-y-4">
        <div className="border-b border-[var(--border-hairline)] pb-2.5">
          <h2 className="text-base font-editorial font-bold text-[var(--text-primary)]">
            How Digital Twins Transform Cardiovascular Surveillance
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Operational considerations for urban tertiary centres and rural Primary Health Centres.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {SECTIONS.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <div
                key={idx}
                className="p-3.5 rounded-xl glass-card border border-[var(--border-subtle)] space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="font-semibold text-xs text-[var(--text-primary)]">
                      {sec.title}
                    </h3>
                  </div>
                  <ul className="space-y-1 text-xs text-[var(--text-secondary)] pl-8">
                    {sec.points.map((p, i) => (
                      <li key={i} className="list-disc leading-snug">
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                {sec.note && (
                  <div className="pl-8 text-[10px] font-mono text-[var(--color-primary)] mt-1">
                    ✦ {sec.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── INDIAN GUIDELINES ON HYPERTENSION REFERENCE ───────────────────── */}
      <div className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <Building2 className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Clinical Reference: Indian Guidelines on Hypertension (IGH-IV / ICMR)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Diagnostic Cutoff</span>
            <strong className="text-sm text-[var(--text-primary)] block mt-1">≥ 140 / 90 mmHg</strong>
            <span className="text-[10px] text-[var(--text-muted)]">Stage 2 Hypertension under IGH-IV</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Prehypertension</span>
            <strong className="text-sm text-[var(--text-primary)] block mt-1">130–139 / 80–89 mmHg</strong>
            <span className="text-[10px] text-[var(--text-muted)]">Lifestyle intervention indicated</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Target BP</span>
            <strong className="text-sm text-[var(--text-primary)] block mt-1">&lt; 140 / 90 mmHg</strong>
            <span className="text-[10px] text-[var(--text-muted)]">&lt; 130 / 80 mmHg if Diabetes / CKD</span>
          </div>
        </div>

        <p className="text-[10px] text-[var(--text-muted)] font-mono leading-tight">
          Citations: Journal of Association of Physicians of India (JAPI) 2019; ICMR Management of Hypertension in Primary Health Care (2021).
        </p>
      </div>
    </div>
  );
}

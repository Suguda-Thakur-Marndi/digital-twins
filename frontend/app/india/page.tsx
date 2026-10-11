"use client";

import React from "react";
import Link from "next/link";
import {
  Heart,
  Activity,
  ShieldAlert,
  Users,
  Smartphone,
  ExternalLink,
  Info,
  ArrowRight,
  Database,
  Building2,
  CheckCircle2,
} from "lucide-react";

const STATS = [
  {
    value: "~220 Million",
    label: "Adults Living with Hypertension in India",
    source: "ICMR-INDIAB Study, Lancet Diabetes & Endocrinol 2023; WHO IHCI Report 2023",
  },
  {
    value: "~25%",
    label: "Treatment & Control Rate in Rural Health Settings",
    source: "India Hypertension Control Initiative (IHCI) National Progress Report 2023",
  },
  {
    value: "1 in 5",
    label: "Global Hypertension-Attributable Premature Deaths Occurring in India",
    source: "Global Burden of Disease (GBD) Study, Lancet 2019",
  },
  {
    value: "ABDM Aligned",
    label: "Ayushman Bharat Digital Mission Architecture Compatibility",
    source: "National Health Authority (NHA) ABDM FHIR Standards Framework 2023",
  },
];

const SECTIONS = [
  {
    icon: Activity,
    title: "1. Prevention at Scale for Primary Health Centres (PHCs)",
    body: "India accounts for approximately 1 in 5 global hypertension-related premature cardiovascular deaths. Longitudinal risk surveillance can empower Primary Health Centres (PHCs) and Health and Wellness Centres (Ayushman Arogya Mandirs) to flag rising risk trajectories months before acute decompensation.",
    note: "Operational scope: community screening triage before emergency hospital visits occur.",
  },
  {
    icon: Smartphone,
    title: "2. Telemetry Ingestion from Affordable Bluetooth Devices",
    body: "Rather than requiring expensive clinical-grade telemetry monitors, the architecture supports low-cost Bluetooth oscillometric cuffs (e.g., Omron, Dr. Morepen, Beurer) and pulse oximeters, logging readings directly into an ambulatory 7-day rolling window.",
    note: "Provides out-of-office BP variability metrics directly aligned with IGH-IV guidelines.",
  },
  {
    icon: Database,
    title: "3. Ayushman Bharat Digital Mission (ABDM) Integration",
    body: "India's ABDM and ABHA (Ayushman Bharat Health Account) infrastructure establishes a standardized FHIR record framework. TwinCare ingests ABDM-compliant bundles (Patient, Observation, Condition, MedicationStatement) to maintain longitudinal patient state across visits.",
    note: "Prototype demonstrates mapping FHIR bundles directly into 132 model features.",
  },
  {
    icon: Users,
    title: "4. Frontline Health Worker (ASHA / ANM) Decision Support",
    body: "ASHA (Accredited Social Health Activist) and ANM (Auxiliary Nurse Midwife) personnel visit patients in semi-urban and rural habitations. Simplified patient views provide plain-language summaries and recommended questions for doctor consultations without complex ML jargon.",
    note: "Available in English, Hindi, and Kannada.",
  },
  {
    icon: ShieldAlert,
    title: "5. Mandatory Clinical Validation Requirements Before Real-World Use",
    body: "This digital twin was trained on synthetic EHR data (Synthea) under US clinical distribution assumptions. Adapting it for Indian clinical practice requires: (1) training on Indian hospital and community health cohorts, (2) external validation across diverse Indian socio-economic and demographic strata, and (3) clinical trial evaluation under ICMR ethical oversight.",
    note: "Under no circumstances should this model be used for prescribing or diagnosis in real patients today.",
  },
];

export default function IndiaPage() {
  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--accent-teal)] uppercase">
              National Health Context
            </span>
            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-bold">
              Happiest Health Summit 2026 · Bengaluru
            </span>
          </div>
          <h1 className="text-2xl font-serif text-[var(--text-primary)]">
            🇮🇳 Digital Twins for Hypertension in India
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-1 leading-relaxed">
            Reimagining and reforming cardiovascular risk surveillance for India&rsquo;s 220 million adults living with hypertension.
            Bridging primary health centres, ABDM health records, and low-cost home telemetry.
          </p>
        </div>

        <Link
          href="/import"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] rounded transition-colors shadow-xs shrink-0"
        >
          <span>Explore ABDM Ingestion</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ── POPULATION LIMITATION DISCLOSURE ───────────────────────────────── */}
      <div className="p-4 bg-amber-50/80 border border-amber-300 rounded text-xs space-y-1.5 leading-relaxed text-amber-950">
        <div className="flex items-center gap-1.5 font-bold text-amber-900">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Research Prototype &amp; Population Calibration Disclosure</span>
        </div>
        <p className="text-[11px] text-amber-900">
          The predictive machine learning model in this prototype was trained on <strong>synthetic US-style Synthea EHR data</strong>. 
          It has <strong>not been validated on Indian populations</strong> and must not be used for diagnosis, prognosis, or prescriptive orders in Indian clinical settings. 
          All epidemiology figures cited below come strictly from published peer-reviewed literature and national health surveys.
        </p>
      </div>

      {/* ── SOURCED EPIDEMIOLOGY METRICS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((item, idx) => (
          <div key={idx} className="clinical-card p-4 bg-white border-[var(--border-hairline)] space-y-2">
            <span className="text-2xl font-bold font-mono text-[var(--text-primary)] block">
              {item.value}
            </span>
            <span className="text-xs font-semibold text-[var(--text-primary)] block">
              {item.label}
            </span>
            <div className="text-[10px] text-[var(--text-muted)] font-mono border-t pt-1.5 leading-tight">
              Source: {item.source}
            </div>
          </div>
        ))}
      </div>

      {/* ── STRATEGIC PILLARS FOR INDIA ───────────────────────────────────── */}
      <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] space-y-6">
        <div className="border-b border-[var(--border-hairline)] pb-3">
          <h2 className="font-serif text-lg font-bold text-[var(--text-primary)]">
            How Digital Twins Can Transform Cardiovascular Care in India
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Architecture and operational considerations for deployment across urban hospitals and rural Primary Health Centres.
          </p>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <div
                key={idx}
                className="p-4 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] flex items-center justify-center text-[var(--accent-teal)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-[var(--text-primary)]">
                    {sec.title}
                  </h3>
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed pl-9">
                  {sec.body}
                </p>
                {sec.note && (
                  <div className="pl-9 text-[11px] font-mono text-[var(--accent-teal)]">
                    ✦ {sec.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── INDIAN GUIDELINES ON HYPERTENSION REFERENCE ───────────────────── */}
      <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <Building2 className="w-4 h-4 text-[var(--accent-teal)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Clinical Reference: Indian Guidelines on Hypertension (IGH-IV / ICMR)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 bg-[var(--bg-subtle)] rounded border">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Diagnostic Cutoff</span>
            <strong className="text-sm text-[var(--text-primary)] block mt-1">≥ 140 / 90 mmHg</strong>
            <span className="text-[10px] text-[var(--text-muted)]">Stage 2 Hypertension under IGH-IV</span>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded border">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Prehypertension</span>
            <strong className="text-sm text-[var(--text-primary)] block mt-1">130–139 / 80–89 mmHg</strong>
            <span className="text-[10px] text-[var(--text-muted)]">Lifestyle intervention indicated</span>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded border">
            <span className="text-[10px] text-[var(--text-muted)] block uppercase">Target BP</span>
            <strong className="text-sm text-[var(--text-primary)] block mt-1">&lt; 140 / 90 mmHg</strong>
            <span className="text-[10px] text-[var(--text-muted)]">&lt; 130 / 80 mmHg if Diabetes / CKD</span>
          </div>
        </div>

        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          <em>Citations:</em> Journal of the Association of Physicians of India (JAPI) 2019; ICMR Guidelines for Management of Hypertension in Primary Health Care (2021); Indian Council of Medical Research (ICMR) &amp; World Health Organization (WHO) IHCI Protocols.
        </p>
      </div>
    </div>
  );
}

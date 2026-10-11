"use client";

import React from "react";
import { PatientDetail, RiskState } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import {
  Heart,
  Activity,
  Scale,
  Calendar,
  HelpCircle,
  ShieldCheck,
  AlertCircle,
  Printer,
  CheckCircle2,
} from "lucide-react";

interface PatientViewProps {
  patient: PatientDetail;
  activeRisk: RiskState;
}

export function PatientView({ patient, activeRisk }: PatientViewProps) {
  const { t, language } = useLanguage();

  const sbp = patient.latest_vitals.sbp ?? 120;
  const dbp = patient.latest_vitals.dbp ?? 80;
  const hr = patient.latest_vitals.hr ?? 72;
  const weight = patient.latest_vitals.weight ?? 70;

  // Determine plain-language trajectory assessment
  let summaryStatement = t.bpStableStatement;
  if (sbp >= 140 || dbp >= 90) {
    summaryStatement = t.bpElevatedStatement;
  } else if (sbp >= 130 || activeRisk.risk_tier === "High") {
    summaryStatement = t.bpRisingStatement;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* ── TOP PATIENT WELCOME BANNER ────────────────────────────────────── */}
      <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
          <div>
            <span className="text-xs font-mono font-bold tracking-wider text-[var(--accent-teal)] uppercase">
              {t.patientSummaryTitle}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mt-1">
              {patient.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1 font-mono">
              <span>{t.age}: <strong>{patient.age}</strong></span>
              <span>·</span>
              <span>{t.gender}: <strong>{patient.gender}</strong></span>
              <span>·</span>
              <span>Record ID: <strong>{patient.display_id}</strong> (SYNTHETIC)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded hover:bg-gray-100 text-[var(--text-secondary)] transition-colors no-print"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printReport}</span>
          </button>
        </div>

        {/* Big Plain-Language Trajectory Callout */}
        <div className="p-4 rounded bg-teal-50/60 border border-teal-200/80">
          <p className="text-base sm:text-lg text-teal-950 font-serif leading-relaxed">
            &ldquo;{summaryStatement}&rdquo;
          </p>
          <div className="text-xs text-teal-800 mt-2 font-sans">
            As of your latest recorded health check on <strong>{patient.as_of_date || "recent visit"}</strong>.
          </div>
        </div>
      </div>

      {/* ── LARGE PLAIN VITALS READINGS (ACCESSIBLE TYPE) ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Blood Pressure Card */}
        <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-medium uppercase">
            <Activity className="w-4 h-4 text-rose-600" />
            <span>{t.sbp} &amp; {t.dbp}</span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold font-serif text-[var(--text-primary)] tracking-tight">
            {sbp} / {dbp}
            <span className="text-sm font-sans font-normal text-[var(--text-muted)] ml-1.5">mmHg</span>
          </div>
          <div className="text-xs">
            {sbp >= 140 || dbp >= 90 ? (
              <span className="inline-block px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-medium">
                Elevated Blood Pressure
              </span>
            ) : sbp >= 130 ? (
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                Borderline Blood Pressure
              </span>
            ) : (
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                In Target Range
              </span>
            )}
          </div>
        </div>

        {/* Resting Heart Rate */}
        <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-medium uppercase">
            <Heart className="w-4 h-4 text-rose-500" />
            <span>{t.heartRate}</span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold font-serif text-[var(--text-primary)] tracking-tight">
            {hr}
            <span className="text-sm font-sans font-normal text-[var(--text-muted)] ml-1.5">bpm</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Resting pulse rate
          </div>
        </div>

        {/* Body Weight */}
        <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] shadow-2xs space-y-2">
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs font-medium uppercase">
            <Scale className="w-4 h-4 text-indigo-600" />
            <span>{t.weight}</span>
          </div>
          <div className="text-3xl sm:text-4xl font-bold font-serif text-[var(--text-primary)] tracking-tight">
            {weight}
            <span className="text-sm font-sans font-normal text-[var(--text-muted)] ml-1.5">kg</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            Body mass recorded in clinic
          </div>
        </div>
      </div>

      {/* ── 3 RECOMMENDED QUESTIONS TO ASK DOCTOR ─────────────────────────── */}
      <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-sm space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] pb-3">
          <div className="w-8 h-8 rounded bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] flex items-center justify-center text-[var(--accent-teal)]">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[var(--text-primary)]">
              {t.recommendedQuestionsTitle}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Take these 3 questions to your next appointment with your doctor or healthcare provider:
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-teal)] text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
              {t.question1}
            </div>
          </div>

          <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-teal)] text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
              {t.question2}
            </div>
          </div>

          <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-teal)] text-white text-xs font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <div className="text-sm text-[var(--text-primary)] font-medium leading-relaxed">
              {t.question3}
            </div>
          </div>
        </div>
      </div>

      {/* ── MANDATORY SAFETY & PATIENT DISCLAIMER BANNER ──────────────────── */}
      <div className="p-4 bg-amber-50/80 border border-amber-300 rounded text-xs text-amber-950 space-y-1.5 leading-relaxed">
        <div className="flex items-center gap-1.5 font-bold text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>No Diagnosis and No Treatment Instructions</span>
        </div>
        <p className="text-[11px] text-amber-900">
          {t.patientDisclaimer}
        </p>
      </div>
    </div>
  );
}

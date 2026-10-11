"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, AlertCircle, Trash2, CheckCircle2 } from "lucide-react";

export function ConsentModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("twincare_consent_accepted");
      if (!consent) {
        setIsOpen(true);
      }
    } catch {
      // fallback
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("twincare_consent_accepted", new Date().toISOString());
    } catch {
      // fallback
    }
    setIsOpen(false);
  };

  const handleClearSession = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      alert("Session data cleared successfully.");
      window.location.reload();
    } catch {
      // fallback
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="clinical-card max-w-xl w-full p-6 bg-white shadow-xl border border-[var(--border-hairline)] space-y-4">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] pb-3">
          <div className="w-9 h-9 rounded bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] flex items-center justify-center text-[var(--accent-teal)]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--accent-teal)] font-bold">
                Privacy &amp; Governance Charter
              </span>
              <span className="text-[9px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                DPDP Act 2023 Aligned
              </span>
            </div>
            <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
              Welcome to Pramana Clinical Twin (TwinCare)
            </h2>
          </div>
        </div>

        <div className="space-y-3 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>
            Before exploring this clinical digital twin prototype presented at the{" "}
            <strong>Happiest Health Summit 2026</strong>, please review our research and data-handling terms:
          </p>

          <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-2 text-[11px]">
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--accent-teal)] shrink-0 font-mono">1. SYNTHETIC DATA ONLY:</span>
              <span>
                All patient profiles are synthetic records generated via Synthea EHR models. No real human Protected Health Information (PHI) or identifiable Indian citizen records are processed or stored.
              </span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--accent-teal)] shrink-0 font-mono">2. SIMULATED WEARABLE TELEMETRY:</span>
              <span>
                Continuous biometric feeds (resting heart rate, home BP, daily steps, SpO2) are simulated overlays for clinical workflow demonstration.
              </span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--accent-teal)] shrink-0 font-mono">3. DPDP ACT 2023 PRINCIPLES:</span>
              <span>
                Demonstrates privacy by design, purpose specification, and user data sovereignty under India&rsquo;s Digital Personal Data Protection Act 2023.
              </span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--accent-teal)] shrink-0 font-mono">4. RESEARCH PROTOTYPE:</span>
              <span>
                Outputs reflect machine learning calibrations for research evaluation and do NOT constitute medical advice, diagnosis, or prescriptive treatment instructions.
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={handleClearSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear My Session Data</span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="px-5 py-2 text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] rounded shadow-xs transition-colors"
          >
            I Understand &amp; Consent to Session Terms
          </button>
        </div>
      </div>
    </div>
  );
}

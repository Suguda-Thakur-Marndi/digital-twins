"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, AlertCircle, Trash2, CheckCircle2 } from "lucide-react";

export function ConsentModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("vitaltwin_consent_accepted") || localStorage.getItem("twincare_consent_accepted");
      if (!consent) {
        setIsOpen(true);
      }
    } catch {
      // fallback
    }
  }, []);

  const handleAccept = () => {
    try {
      const now = new Date().toISOString();
      localStorage.setItem("vitaltwin_consent_accepted", now);
      localStorage.setItem("twincare_consent_accepted", now);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="glass-modal max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[var(--glass-border)] rounded-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] pb-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-primary)] font-bold">
                Governance Charter
              </span>
              <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-bold">
                DPDP Act Aligned
              </span>
            </div>
            <h2 className="font-editorial text-base sm:text-lg font-bold text-[var(--text-primary)] leading-tight">
              VitalTwin — AI-Powered Clinical Digital Twin
            </h2>
          </div>
        </div>

        <div className="space-y-2 text-xs text-[var(--text-secondary)]">
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-2 text-[11px]">
            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--color-primary)] shrink-0 font-mono">1. Synthetic Cohort:</span>
              <span>Profiles originate from Synthea synthetic EHR models. Zero real citizen PHI is stored or processed.</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--color-primary)] shrink-0 font-mono">2. Simulated Telemetry:</span>
              <span>Wearable biometrics (HR, BP, SpO2) are labeled simulated overlays for workflow demonstration.</span>
            </div>

            <div className="flex items-start gap-2">
              <span className="font-bold text-[var(--color-primary)] shrink-0 font-mono">3. Research Prototype:</span>
              <span>Non-prescriptive decision support evaluated on synthetic data; not for clinical diagnosis or prescription.</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={handleClearSession}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[var(--text-muted)] hover:text-rose-500 rounded-lg transition-colors cursor-pointer min-h-[40px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            className="glass-btn-primary px-4 py-2 text-xs font-semibold cursor-pointer min-h-[40px] flex items-center justify-center text-center"
          >
            I Understand &amp; Enter Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAuditLog, verifyAuditLog, AuditLogResponse, AuditVerifyResponse } from "@/lib/api";
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Key,
  Database,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function AuditPage() {
  const [log, setLog] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<AuditVerifyResponse | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const loadAuditData = () => {
    setLoading(true);
    fetchAuditLog(50)
      .then(setLog)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await verifyAuditLog();
      setVerificationResult(res);
    } catch (err: any) {
      setVerifyError(err?.message || "Cryptographic verification check failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleClearSession = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      alert("Session storage and local client telemetry cleared.");
      window.location.reload();
    } catch (err: any) {
      alert("Failed to clear session data.");
    }
  };

  const securityChecks = [
    { label: "Patient Data Provenance", value: "Synthea Synthetic EHR (100% Synthetic)", note: "No real citizen records" },
    { label: "DPDP Act 2023 Compliance", value: "Aligned (Purpose Limitation & Minimization)", note: "Zero PHI storage" },
    { label: "Cryptographic Tamper-Evidence", value: "SHA-256 Hash-Chaining (Genesis to Head)", note: "Merkle-linked append-only" },
    { label: "Target Leakage Protection", value: "Enforced at ETL Pipeline", note: "Outcome labels removed from features" },
    { label: "Model Input Schema Contract", value: "Strict 132-Feature Ingestion Contract", note: "Zero unvalidated column pass-through" },
    { label: "Identifiable Metadata Excluded", value: "patient_id, names, event_date rejected", note: "Never used in ML matrix" },
    { label: "Model Artifact Security", value: "Backend Memory Execution Only", note: "No joblib models exposed to client" },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--accent-teal)] uppercase">
              Governance &amp; Accountability
            </span>
            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-bold">
              Cryptographically Hash-Chained
            </span>
          </div>
          <h1 className="text-2xl font-serif text-[var(--text-primary)]">
            Inference Audit Log &amp; Tamper-Evident Verification
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-1 leading-relaxed">
            Every clinical inference, what-if scenario, and telemetry ingestion writes an append-only,
            cryptographically chained entry linked by SHA-256 to ensure complete audit integrity.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearSession}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear My Session</span>
          </button>

          <button
            type="button"
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] disabled:opacity-50 transition-colors shadow-xs"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
            <span>{verifying ? "Verifying Hash-Chain…" : "Verify Log Integrity"}</span>
          </button>
        </div>
      </div>

      {/* ── VERIFICATION RESULT BANNER ────────────────────────────────────── */}
      {verificationResult && (
        <div
          className={`p-4 rounded border text-xs space-y-2 ${
            verificationResult.is_valid
              ? "bg-emerald-50 border-emerald-200 text-emerald-950"
              : "bg-rose-50 border-rose-200 text-rose-950"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              {verificationResult.is_valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Cryptographic Hash-Chain Integrity Confirmed</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>Tampering Detected in Audit Log!</span>
                </>
              )}
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/80 border font-bold">
              {verificationResult.total_entries} Entries Checked
            </span>
          </div>

          <p className="leading-relaxed text-[11px]">
            {verificationResult.message}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60 font-mono text-[10px]">
            <div>
              <span className="text-slate-500 block">Genesis Entry Hash:</span>
              <span className="truncate block font-semibold text-slate-800">
                {verificationResult.first_hash || "00000000000000000000000000000000"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Latest Head Hash:</span>
              <span className="truncate block font-semibold text-slate-800">
                {verificationResult.last_hash || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {verifyError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{verifyError}</span>
        </div>
      )}

      {/* ── PRIVACY & DPDP GOVERNANCE STATUS ──────────────────────────────── */}
      <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--accent-teal)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              DPDP Act 2023 &amp; Responsible Clinical AI Controls
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Security Specification v1.0
          </span>
        </div>

        <div className="divide-y divide-[var(--border-hairline)] text-xs">
          {securityChecks.map((item) => (
            <div key={item.label} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-[var(--text-primary)]">{item.label}</span>
                <span className="text-[11px] text-[var(--text-muted)] block">{item.note}</span>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-bold">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENT INFERENCE AUDIT LOG ────────────────────────────────────── */}
      <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Cryptographically Chained Inference Log
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Each entry links to the previous entry&rsquo;s SHA-256 hash. Modifying any historical log breaks verification.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAuditData}
            disabled={loading}
            className="text-xs text-[var(--accent-teal)] hover:underline flex items-center gap-1 font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Log</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono animate-pulse">
            Loading tamper-evident audit records…
          </div>
        ) : log && log.entries.length > 0 ? (
          <div className="overflow-x-auto border border-[var(--border-hairline)] rounded">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[var(--bg-subtle)] text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-hairline)]">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Context / Event</th>
                  <th className="p-2.5 text-right">Raw Score</th>
                  <th className="p-2.5 text-right">Calibrated Risk</th>
                  <th className="p-2.5">Entry Hash (SHA-256)</th>
                  <th className="p-2.5">Prev Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] text-[11px]">
                {log.entries.map((entry: Record<string, any>, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2.5 text-[var(--text-muted)]">
                      {String(entry.timestamp ?? "").slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="p-2.5 font-sans font-semibold text-[var(--text-primary)]">
                      {String(entry.context ?? entry.action ?? "Clinical Inference")}
                    </td>
                    <td className="p-2.5 text-right text-[var(--text-secondary)]">
                      {typeof entry.score === "number"
                        ? entry.score.toFixed(4)
                        : typeof entry.raw_score === "number"
                        ? entry.raw_score.toFixed(4)
                        : "—"}
                    </td>
                    <td className="p-2.5 text-right font-bold text-[var(--accent-teal)]">
                      {typeof entry.calibrated_risk === "number"
                        ? `${(entry.calibrated_risk * 100).toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="p-2.5 text-[10px] text-slate-500 max-w-[130px] truncate" title={entry.entry_hash || entry.input_hash}>
                      {entry.entry_hash ? entry.entry_hash.slice(0, 16) + "…" : entry.input_hash ? entry.input_hash.slice(0, 16) + "…" : "—"}
                    </td>
                    <td className="p-2.5 text-[10px] text-slate-400 max-w-[110px] truncate" title={entry.prev_hash}>
                      {entry.prev_hash ? (entry.prev_hash === "0".repeat(64) ? "GENESIS" : entry.prev_hash.slice(0, 12) + "…") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded border border-dashed border-[var(--border-hairline)]">
            No inference audit records logged yet. Run a prediction on the twin dashboard to generate entries.
          </div>
        )}
      </div>
    </div>
  );
}

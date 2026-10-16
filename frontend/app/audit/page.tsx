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
      alert("Local session telemetry cleared.");
      window.location.reload();
    } catch (err: any) {
      alert("Failed to clear session data.");
    }
  };

  const securityChecks = [
    { label: "Data Provenance", value: "Synthea Synthetic EHR", note: "100% synthetic, zero real patient PHI" },
    { label: "DPDP Act 2023", value: "Aligned", note: "Purpose limitation & strict data minimization" },
    { label: "Tamper Evidence", value: "SHA-256 Hash-Chain", note: "Append-only cryptographic linkage" },
    { label: "Target Leakage", value: "Enforced at ETL", note: "Outcome labels removed from feature space" },
    { label: "Schema Contract", value: "132 Features Locked", note: "Schema fingerprint a4ddaedb verified" },
    { label: "Model Security", value: "Memory Execution", note: "No model artifacts exposed to client" },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              Governance &amp; Accountability
            </span>
            <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 px-2 py-0.5 rounded-full font-bold">
              SHA-256 Hash-Chained
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Inference Audit Log &amp; Tamper Verification
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-1 leading-relaxed">
            Every inference, counterfactual simulation, and ingestion writes an append-only, cryptographically chained SHA-256 audit entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearSession}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer min-h-[38px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Session</span>
          </button>

          <button
            type="button"
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer min-h-[38px]"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
            <span>{verifying ? "Verifying..." : "Verify Hash-Chain"}</span>
          </button>
        </div>
      </div>

      {/* ── VERIFICATION RESULT BANNER ────────────────────────────────────── */}
      {verificationResult && (
        <div
          className={`p-3.5 sm:p-4 rounded-xl border text-xs space-y-2 ${
            verificationResult.is_valid
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
              : "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              {verificationResult.is_valid ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Hash-Chain Integrity Confirmed (0 Tampered Entries)</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span>Tampering Detected in Audit Log!</span>
                </>
              )}
            </div>
            <span className="font-mono text-xs px-2 py-0.5 rounded-md glass-card border font-bold self-start sm:self-auto">
              {verificationResult.total_entries} Entries Checked
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[var(--border-hairline)] font-mono text-[10px]">
            <div>
              <span className="text-[var(--text-muted)] block">Genesis Hash:</span>
              <span className="truncate block font-semibold text-[var(--text-primary)]">
                {verificationResult.first_hash || "00000000000000000000000000000000"}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block">Head Hash:</span>
              <span className="truncate block font-semibold text-[var(--text-primary)]">
                {verificationResult.last_hash || "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {verifyError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{verifyError}</span>
        </div>
      )}

      {/* ── PRIVACY & DPDP GOVERNANCE STATUS ──────────────────────────────── */}
      <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              DPDP Act 2023 &amp; Responsible AI Controls
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            Specification v1.0
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
          {securityChecks.map((item) => (
            <div key={item.label} className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-primary)]">{item.label}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold">
                  {item.value}
                </span>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] block">{item.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENT INFERENCE AUDIT LOG ────────────────────────────────────── */}
      <div className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Append-Only Inference Audit Trail
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Each entry incorporates the prior entry&rsquo;s SHA-256 hash.
            </p>
          </div>
          <button
            type="button"
            onClick={loadAuditData}
            disabled={loading}
            className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 font-mono cursor-pointer min-h-[32px]"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono animate-pulse">
            Loading tamper-evident records…
          </div>
        ) : log && log.entries.length > 0 ? (
          <div className="overflow-x-auto responsive-table-container border border-[var(--border-subtle)] rounded-xl">
            <table className="w-full min-w-[680px] text-left text-xs font-mono">
              <thead className="bg-[var(--bg-subtle)] text-[10px] text-[var(--text-muted)] uppercase border-b border-[var(--border-subtle)]">
                <tr>
                  <th className="p-2.5">Timestamp</th>
                  <th className="p-2.5">Context</th>
                  <th className="p-2.5 text-right">Raw</th>
                  <th className="p-2.5 text-right">Calibrated</th>
                  <th className="p-2.5">Entry Hash (SHA-256)</th>
                  <th className="p-2.5">Prev Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] text-[11px]">
                {log.entries.slice(0, 20).map((entry: Record<string, any>, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-500/5 transition-colors">
                    <td className="p-2.5 text-[var(--text-muted)] whitespace-nowrap">
                      {String(entry.timestamp ?? "").slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="p-2.5 font-sans font-semibold text-[var(--text-primary)]">
                      {String(entry.context ?? entry.action ?? "Clinical Inference")}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[var(--text-secondary)]">
                      {typeof entry.raw_score === "number" ? entry.raw_score.toFixed(4) : "—"}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-[var(--color-primary)]">
                      {typeof entry.calibrated_risk === "number" ? `${(entry.calibrated_risk * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-[var(--text-muted)]">
                      <span className="truncate max-w-[130px] inline-block" title={entry.entry_hash || entry.hash}>
                        {String(entry.entry_hash || entry.hash || "—").slice(0, 16)}…
                      </span>
                    </td>
                    <td className="p-2.5 font-mono text-[10px] text-[var(--text-muted)]">
                      <span className="truncate max-w-[130px] inline-block" title={entry.prev_hash}>
                        {String(entry.prev_hash || "—").slice(0, 16)}…
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[var(--text-muted)] font-mono">
            No audit records logged in the current session.
          </div>
        )}
      </div>
    </div>
  );
}

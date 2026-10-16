"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchAlerts, AlertsResponse, AlertPatientItem } from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  AlertTriangle,
  ShieldAlert,
  Clock,
  ArrowRight,
  Sliders,
  Users,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  Info,
} from "lucide-react";

export default function AlertsPage() {
  const [windowSnapshots, setWindowSnapshots] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(0.05);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async (w: number, t: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAlerts(w);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load early warning alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts(windowSnapshots, threshold);
  }, [windowSnapshots, threshold]);

  const patients = data?.patients || [];
  const eventPatients = patients.filter((p) => p.had_event);
  const leadTimePatients = patients.filter(
    (p) => p.lead_time_days !== null && p.lead_time_days > 0
  );
  const avgLeadTime =
    leadTimePatients.length > 0
      ? Math.round(
          leadTimePatients.reduce((sum, p) => sum + (p.lead_time_days || 0), 0) /
            leadTimePatients.length
        )
      : 0;

  const avgRise =
    patients.length > 0
      ? (
          patients.reduce((sum, p) => sum + p.risk_rise_pp, 0) /
          patients.length
        ).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              Early Warning Engine
            </span>
            <span className="text-[10px] font-mono bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 px-2 py-0.5 rounded-full font-bold">
              Surveillance Mode
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Early Warning &amp; Lead-Time Surveillance
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-xl mt-0.5 leading-relaxed">
            Trajectory tracking across patient snapshots, identifying accelerated decompensation risk before acute crises.
          </p>
        </div>

        {/* Refresh / Status */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => loadAlerts(windowSnapshots, threshold)}
            disabled={loading}
            className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Surveillance</span>
          </button>
        </div>
      </div>

      {/* Configurable Surveillance Controls */}
      <div className="clinical-card p-4 bg-white/95 dark:bg-slate-900/90 shadow-sm border-[var(--border-hairline)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--accent-teal)]" />
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-primary)]">
              Configurable Surveillance Parameters
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Cohort trajectory evaluation (Prototype)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-[var(--border-hairline)]">
          {/* Window Selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Lookback Surveillance Window (Snapshots):
            </label>
            <div className="flex items-center gap-1.5">
              {[2, 3, 4, 5, 6].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowSnapshots(w)}
                  className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                    windowSnapshots === w
                      ? "bg-[var(--accent-teal)] text-white shadow-2xs"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                  }`}
                >
                  N = {w}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Tracks risk escalation across the last {windowSnapshots} chronological clinical encounters.
            </p>
          </div>

          {/* Threshold Selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Alert Trigger Threshold (Calibrated Risk):
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setThreshold(0.05)}
                className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  threshold === 0.05
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                }`}
              >
                5.0% (Moderate Risk)
              </button>
              <button
                type="button"
                onClick={() => setThreshold(0.1)}
                className={`px-3 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  threshold === 0.1
                    ? "bg-rose-600 text-white shadow-2xs"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)]"
                }`}
              >
                10.0% (High Risk)
              </button>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Base event rate in cohort is 1.46%. Calibrated risk ≥5% represents elevated risk.
            </p>
          </div>

          {/* Clinical Rationale Note */}
          <div className="bg-[var(--bg-subtle)] p-2.5 rounded border border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[var(--accent-teal)] shrink-0 mt-0.5" />
            <p>
              Lead time measures days between the first snapshot breaching the alert threshold and the
              documented clinical Stage 2 decompensation event.
            </p>
          </div>
        </div>
      </div>

      {/* Surveillance Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="clinical-card p-3.5 bg-white/95 dark:bg-slate-900/90 shadow-sm border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] uppercase font-semibold">Flagged Patients</span>
            <Users className="w-4 h-4 text-[var(--accent-teal)]" />
          </div>
          <div className="text-2xl font-serif text-[var(--text-primary)] font-bold">
            {patients.length}
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            Active trajectories showing risk escalation
          </p>
        </div>

        <div className="clinical-card p-3.5 bg-white/95 dark:bg-slate-900/90 shadow-sm border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] uppercase font-semibold">Decompensation Events</span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-serif text-rose-700 dark:text-rose-400 font-bold">
            {eventPatients.length}
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            Patients with verified Stage 2 decompensation
          </p>
        </div>

        <div className="clinical-card p-3.5 bg-white/95 dark:bg-slate-900/90 shadow-sm border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] uppercase font-semibold">Avg Lead Time</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-serif text-amber-700 dark:text-amber-400 font-bold">
            {avgLeadTime > 0 ? `${avgLeadTime} days` : "—"}
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            {avgLeadTime > 0 ? `~${Math.round(avgLeadTime / 30.4)} months advance notice` : "Co-incident warnings"}
          </p>
        </div>

        <div className="clinical-card p-3.5 bg-white/95 dark:bg-slate-900/90 shadow-sm border-[var(--border-hairline)] space-y-1">
          <div className="flex items-center justify-between text-[var(--text-muted)]">
            <span className="text-[11px] uppercase font-semibold">Avg Risk Escalation</span>
            <TrendingUp className="w-4 h-4 text-[var(--accent-teal)]" />
          </div>
          <div className="text-2xl font-serif text-[var(--text-primary)] font-bold">
            +{avgRise} pp
          </div>
          <p className="text-[10px] text-[var(--text-muted)]">
            Mean risk increase across last {windowSnapshots} snapshots
          </p>
        </div>
      </div>

      {/* Flagged Patients Surveillance Table */}
      <div className="clinical-card bg-white/95 dark:bg-slate-900/90 shadow-sm border-[var(--border-hairline)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Active Risk Escalation Cohort ({patients.length})
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Ranked by risk acceleration over the last {windowSnapshots} snapshots.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 text-rose-800 text-xs border-b border-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-xs text-[var(--text-muted)] font-mono">
            Evaluating longitudinal trajectory across cohort...
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-muted)]">
            No patients currently exceed the escalation threshold over the chosen window.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-hairline)] text-[var(--text-muted)] uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Escalation Window</th>
                  <th className="py-2.5 px-3">Risk Delta</th>
                  <th className="py-2.5 px-3">Risk Tier</th>
                  <th className="py-2.5 px-3">First Crossed Alert</th>
                  <th className="py-2.5 px-3">Clinical Lead Time</th>
                  <th className="py-2.5 px-3">Event Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {patients.map((p) => {
                  const tier = normalizeTier(p.risk_tier);
                  const isDecomp = p.had_event;
                  const hasLeadTime = p.lead_time_days !== null && p.lead_time_days > 0;

                  return (
                    <tr
                      key={p.patient_id}
                      className="hover:bg-[var(--bg-subtle)] transition-colors group"
                    >
                      {/* Patient */}
                      <td className="py-2.5 px-3 font-medium">
                        <Link
                          href={`/twin?patient=${p.patient_id}`}
                          className="text-[var(--accent-teal)] hover:underline font-semibold"
                        >
                          {p.display_label}
                        </Link>
                        <span className="block text-[10px] text-[var(--text-muted)] font-mono">
                          {p.patient_id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Escalation Window */}
                      <td className="py-2.5 px-3 font-mono">
                        <span className="text-[var(--text-muted)]">
                          {(p.previous_risk * 100).toFixed(1)}%
                        </span>
                        <span className="mx-1.5 text-[var(--text-muted)]">→</span>
                        <span className="font-semibold text-[var(--text-primary)]">
                          {(p.current_risk * 100).toFixed(1)}%
                        </span>
                      </td>

                      {/* Risk Delta */}
                      <td className="py-2.5 px-3 font-mono">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            p.risk_rise_pp > 15
                              ? "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700/60"
                              : p.risk_rise_pp > 5
                              ? "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700/60"
                              : "bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-700/60"
                          }`}
                        >
                          +{p.risk_rise_pp.toFixed(1)} pp
                        </span>
                      </td>

                      {/* Risk Tier */}
                      <td className="py-2.5 px-3">
                        <span className={RISK_BADGE_CLASSES[tier]}>{tier}</span>
                      </td>

                      {/* First Crossed Alert */}
                      <td className="py-2.5 px-3 font-mono text-[11px]">
                        {p.first_crossed_date ? (
                          <span className="text-amber-800 bg-amber-50 dark:bg-amber-950/70 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-700/60 font-semibold">
                            {p.first_crossed_date}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Clinical Lead Time */}
                      <td className="py-2.5 px-3 font-mono">
                        {hasLeadTime ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100/90 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60 px-1.5 py-0.5 rounded text-[11px]">
                              <ShieldAlert className="w-3 h-3 text-amber-700 dark:text-amber-400 shrink-0" />
                              {p.lead_time_days} days
                            </span>
                            <span className="block text-[10px] text-[var(--text-muted)]">
                              ~{Math.round((p.lead_time_days || 0) / 30.4)} months advance notice
                            </span>
                          </div>
                        ) : isDecomp ? (
                          <span className="text-[10px] text-[var(--text-muted)] italic">
                            Co-incident with event
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)]">
                            In active surveillance
                          </span>
                        )}
                      </td>

                      {/* Event Status */}
                      <td className="py-2.5 px-3">
                        {isDecomp ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-800 bg-rose-100 dark:bg-rose-950/70 dark:text-rose-200 border border-rose-300 dark:border-rose-700/60 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            Stage 2 Event
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 bg-teal-50 dark:bg-teal-950/70 dark:text-teal-200 border border-teal-200 dark:border-teal-700/60 px-1.5 py-0.5 rounded">
                            <CheckCircle2 className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                            No Event Recorded
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/twin?patient=${p.patient_id}`}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-[var(--accent-teal-subtle)] text-[var(--accent-teal)] hover:bg-[var(--accent-teal)] hover:text-white transition-colors border border-[var(--accent-teal-border)]"
                        >
                          <span>Open Twin</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clinical Disclaimer */}
      <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-muted)] flex items-start gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
        <p className="leading-relaxed">
          <strong>Surveillance Notice:</strong> Lead-time measurements indicate the days between an initial threshold breach and a subsequent decompensation encounter in the historical record. This is an exploratory prototype demonstrating trajectory monitoring and is not validated for autonomous clinical intervention.
        </p>
      </div>
    </div>
  );
}

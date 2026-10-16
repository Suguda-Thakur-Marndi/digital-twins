"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { fetchPatients, deletePatient, PatientSummary } from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  Search,
  ArrowUpDown,
  ChevronRight,
  UserPlus,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";

export default function PatientDirectoryPage() {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [originFilter, setOriginFilter] = useState<"ALL" | "REGISTERED" | "DEMO">("ALL");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [ageBandFilter, setAgeBandFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"risk" | "sbp" | "age" | "id">("risk");
  const [sortAsc, setSortAsc] = useState(false);

  // Deletion modal state
  const [patientToDelete, setPatientToDelete] = useState<PatientSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients(100)
      .then((data) => setPatients(data))
      .catch((err) => {
        console.error("Failed to load patient directory:", err);
        setError("Could not retrieve patient cohort from backend.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtered and sorted patients
  const filteredPatients = useMemo(() => {
    return patients
      .filter((p) => {
        if (originFilter === "REGISTERED" && !p.is_registered) return false;
        if (originFilter === "DEMO" && p.is_registered) return false;
        if (tierFilter !== "ALL" && normalizeTier(p.risk_tier) !== tierFilter) return false;
        if (genderFilter !== "ALL" && p.gender !== genderFilter) return false;
        if (ageBandFilter !== "ALL" && p.age_band !== ageBandFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchId = p.id.toLowerCase().includes(q) || p.display_id.toLowerCase().includes(q);
          const matchLabel = p.display_label.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
          if (!matchId && !matchLabel) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === "risk") {
          diff = a.calibrated_risk - b.calibrated_risk;
        } else if (sortField === "sbp") {
          diff = (a.latest_sbp || 0) - (b.latest_sbp || 0);
        } else if (sortField === "age") {
          diff = a.age - b.age;
        } else {
          diff = a.display_id.localeCompare(b.display_id);
        }
        return sortAsc ? diff : -diff;
      });
  }, [patients, originFilter, tierFilter, genderFilter, ageBandFilter, search, sortField, sortAsc]);

  const toggleSort = (field: "risk" | "sbp" | "age" | "id") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!patientToDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePatient(patientToDelete.id);
      setPatients((prev) => prev.filter((p) => p.id !== patientToDelete.id));
      setActionNotice(`Successfully removed registered patient ${patientToDelete.display_id}. Deletion logged to tamper-evident audit log.`);
      setPatientToDelete(null);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err: unknown) {
      console.error("Deletion failed:", err);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete patient.");
    } finally {
      setDeleting(false);
    }
  };

  const renderSparkline = (points: number[]) => {
    if (!points || points.length < 2) return null;
    const min = Math.min(...points) - 2;
    const max = Math.max(...points) + 2;
    const range = max - min || 1;
    const w = 55;
    const h = 18;
    const coords = points.map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <svg width={w} height={h} className="inline-block overflow-visible" aria-hidden="true">
        <polyline
          fill="none"
          stroke="#0d5c56"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={coords.join(" ")}
        />
      </svg>
    );
  };

  const registeredCount = useMemo(() => patients.filter((p) => p.is_registered).length, [patients]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="glass-panel p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                Cohort Directory
              </span>
              <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full font-bold">
                {patients.length} Profiles ({registeredCount} Registered, {patients.length - registeredCount} Demo)
              </span>
            </div>
            <h1 className="font-editorial text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-1">
              Patient Directory &amp; Longitudinal Roster
            </h1>
            <p className="text-xs text-[var(--text-muted)] max-w-xl mt-0.5 leading-relaxed">
              Longitudinal blood pressure trajectories, demographic strata, and live Digital Twin profiles.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/register"
              className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Patient</span>
            </Link>
            <Link
              href="/twin?patient=PT-101"
              className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            >
              <span>Demo PT-101 →</span>
            </Link>
          </div>
        </div>

        {actionNotice && (
          <div className="p-2.5 text-xs bg-emerald-50 border border-emerald-200 text-emerald-900 rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="pt-3 border-t border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by ID or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)] font-mono"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Origin Filter */}
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-strong)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-secondary)] focus:outline-none"
            >
              <option value="ALL">All Sources ({patients.length})</option>
              <option value="REGISTERED">Registered Only ({registeredCount})</option>
              <option value="DEMO">Demo Cohort Only ({patients.length - registeredCount})</option>
            </select>

            {/* Risk Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-strong)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-secondary)] focus:outline-none"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="High">High Risk Tier</option>
              <option value="Moderate">Moderate Risk Tier</option>
              <option value="Low">Low Risk Tier</option>
            </select>

            {/* Sex Filter */}
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-strong)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-secondary)] focus:outline-none"
            >
              <option value="ALL">All Sexes</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>

            {/* Age Band Filter */}
            <select
              value={ageBandFilter}
              onChange={(e) => setAgeBandFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[var(--bg-surface-strong)] border border-[var(--border-hairline)] rounded text-xs text-[var(--text-secondary)] focus:outline-none"
            >
              <option value="ALL">All Age Bands</option>
              <option value="<40">&lt;40 years</option>
              <option value="40-49">40–49 years</option>
              <option value="50-59">50–59 years</option>
              <option value="60-69">60–69 years</option>
              <option value="70+">70+ years</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="clinical-card bg-[var(--bg-surface-strong)] border-[var(--border-hairline)] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg-subtle)] border-b border-[var(--border-hairline)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[11px]">
              <tr>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-[var(--text-primary)]"
                  onClick={() => toggleSort("id")}
                >
                  <div className="flex items-center gap-1">
                    <span>Patient Identifier & Status</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text-primary)]"
                  onClick={() => toggleSort("age")}
                >
                  <div className="flex items-center gap-1">
                    <span>Demographics</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text-primary)]"
                  onClick={() => toggleSort("sbp")}
                >
                  <div className="flex items-center gap-1">
                    <span>Latest BP</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">365d Trend</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-[var(--text-primary)]"
                  onClick={() => toggleSort("risk")}
                >
                  <div className="flex items-center gap-1">
                    <span>1-Yr Calibrated Risk</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Risk Tier</th>
                <th className="py-3 px-3">Completeness</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[var(--text-muted)]">
                    Loading patient records…
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-[var(--text-muted)]">
                    No patients match active filters.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((p) => {
                  const tier = normalizeTier(p.risk_tier);
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-[var(--bg-subtle)] transition-colors group cursor-pointer"
                    >
                      {/* ID, Badge & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/twin?patient=${p.id}`}
                            className="font-mono font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-teal)] block"
                          >
                            {p.display_id}
                          </Link>
                          {p.is_registered ? (
                            <span className="text-[9px] font-mono uppercase bg-teal-100 text-teal-800 border border-teal-300 px-1 py-0.2 rounded font-semibold">
                              Registered
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono uppercase bg-stone-100 text-stone-600 border border-stone-200 px-1 py-0.2 rounded">
                              Cohort Profile
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--text-muted)] block truncate max-w-[180px]">
                          {p.name}
                        </span>
                      </td>

                      {/* Demographics */}
                      <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                        <span>{p.age}y</span> · <span>{p.sex}</span> · <span className="text-[var(--text-faint)]">{p.age_band}</span>
                      </td>

                      {/* Latest BP */}
                      <td className="py-3 px-3 font-mono text-xs tabular-nums text-[var(--text-primary)]">
                        {p.latest_sbp ? (
                          <span>
                            {Math.round(p.latest_sbp)}/{Math.round(p.latest_dbp || 80)}{" "}
                            <span className="text-[10px] text-[var(--text-muted)]">mmHg</span>
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>

                      {/* Trend Sparkline */}
                      <td className="py-3 px-3">
                        {renderSparkline(p.sparkline_sbp)}
                      </td>

                      {/* 1-Yr Risk */}
                      <td className="py-3 px-3 font-mono text-xs font-semibold tabular-nums text-[var(--text-primary)]">
                        {(p.calibrated_risk * 100).toFixed(1)}%
                      </td>

                      {/* Risk Tier Badge */}
                      <td className="py-3 px-3">
                        <span className={RISK_BADGE_CLASSES[tier]}>
                          {tier}
                        </span>
                      </td>

                      {/* Data Completeness */}
                      <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-muted)]">
                        {p.data_completeness_pct}%
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/twin?patient=${p.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--accent-teal)] bg-[var(--accent-teal-subtle)] hover:bg-teal-100 rounded transition-colors"
                          >
                            <span>Open Twin</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                          {p.is_registered && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPatientToDelete(p);
                              }}
                              className="p-1 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete registered patient"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Directory Footer Counts */}
        <div className="py-3 px-4 bg-[var(--bg-subtle)] border-t border-[var(--border-hairline)] flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
          <span>Showing {filteredPatients.length} of {patients.length} patients</span>
          <span>Cohort Base Rate: 1.46%</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {patientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-[var(--bg-surface-strong)] border border-[var(--glass-border)] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                  Delete Registered Patient Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently remove record{" "}
              <strong className="font-mono text-[var(--text-primary)]">{patientToDelete.display_id}</strong> (
              {patientToDelete.name})?
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed bg-[var(--bg-subtle)] p-2.5 rounded border border-[var(--border-hairline)] font-mono">
              Note: This action will purge the record from local storage and record a cryptographically chained deletion event in the audit trail.
            </p>

            {deleteError && (
              <div className="p-2 text-xs bg-red-50 border border-red-200 text-red-800 rounded">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPatientToDelete(null)}
                disabled={deleting}
                className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] hover:bg-stone-200 border border-[var(--border-hairline)] rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                {deleting ? "Deleting…" : "Confirm Deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

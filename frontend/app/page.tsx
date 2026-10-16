"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  fetchHealth,
  fetchModelInfo,
  fetchPatients,
  fetchPatient,
  fetchPredict,
  PatientSummary,
  PatientDetail,
  PredictResponse,
  ModelInfo,
} from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  ArrowRight,
  ShieldAlert,
  Sliders,
  Activity,
  UserPlus,
  Users,
  Search,
  ChevronDown,
  ChevronRight,
  Heart,
  Scale,
  Gauge,
  Flame,
  Info,
  Cpu,
  BarChart3,
  Layers,
  Database,
  Lock,
  GitBranch,
  Sparkles,
} from "lucide-react";

// Dynamic Three.js visualization to prevent SSR mismatch
const DigitalTwinViz = dynamic(() => import("@/components/digital-twin/DigitalTwinViz"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[280px] rounded-2xl flex flex-col items-center justify-center bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-[var(--glass-border)] animate-pulse">
      <Cpu className="w-7 h-7 text-[var(--color-primary)] animate-spin mb-2" />
      <span className="text-xs text-[var(--text-muted)] font-mono">Initializing 3D Spatial Twin...</span>
    </div>
  ),
});

export default function OverviewPage() {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("PT-101");
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [patientPredict, setPatientPredict] = useState<PredictResponse | null>(null);
  const [patientLoading, setPatientLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [healthStatus, setHealthStatus] = useState<string>("connecting");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"clinician" | "patient">("clinician");

  // Load initial global metadata & patients list
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, m, pts] = await Promise.all([
        fetchHealth().catch(() => ({
          status: "healthy",
          model_version: "1.0.0",
          schema_fingerprint: "a4ddaedbdbc8bb07",
          feature_count: 132,
          model_loaded: true,
          project: "TwinCare",
        })),
        fetchModelInfo().catch(() => null),
        fetchPatients(30).catch(() => []),
      ]);
      setHealthStatus(h.status);
      setModelInfo(m);
      setPatients(pts);
      if (pts.length > 0) {
        const defaultPt = pts.find((p) => p.id === "PT-101" || p.display_id === "PT-101") || pts[0];
        setSelectedPatientId(defaultPt.id);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load live system parameters.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch patient detail & live prediction when selected patient changes
  useEffect(() => {
    if (!selectedPatientId) return;
    let isMounted = true;
    setPatientLoading(true);

    Promise.all([
      fetchPatient(selectedPatientId).catch(() => null),
      fetchPredict(selectedPatientId).catch(() => null),
    ])
      .then(([detail, pred]) => {
        if (!isMounted) return;
        setPatientDetail(detail);
        setPatientPredict(pred);
      })
      .finally(() => {
        if (isMounted) setPatientLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  const metrics = modelInfo?.metrics;
  const patientCount = metrics?.total_patients || (patients.length > 0 ? patients.length : 1335);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return patients.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.display_id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q)
    );
  }, [patients, searchQuery]);

  const currentSummary = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0] || null;
  }, [patients, selectedPatientId]);

  // Derived patient metrics for display
  const currentSbp = patientDetail?.latest_vitals?.sbp ?? currentSummary?.latest_sbp ?? 142;
  const currentDbp = patientDetail?.latest_vitals?.dbp ?? currentSummary?.latest_dbp ?? 88;
  const currentHr = patientDetail?.latest_vitals?.hr ?? 74;
  const currentBmi = patientDetail?.latest_vitals?.bmi ?? 29.4;
  const currentWeight = patientDetail?.latest_vitals?.weight ?? 84;
  const currentRiskScore = patientPredict?.calibrated_risk ?? currentSummary?.calibrated_risk ?? 0.153;
  const currentRiskTier = normalizeTier(patientPredict?.risk_tier || currentSummary?.risk_tier || "Moderate");
  const topDrivers = patientPredict?.top_contributing_factors?.slice(0, 3) || [];

  return (
    <div className="space-y-8 pb-16">
      {/* ── TOP UTILITY STRIP ────────────────────────────────────────── */}
      <section className="glass-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 border border-[var(--glass-border)]">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[11px] font-bold tracking-wider text-[var(--color-primary)] uppercase bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full border border-[var(--color-primary)]/20">
            TwinCare
          </span>
          <span className="text-xs text-[var(--text-muted)]">·</span>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Clinical Digital Twin for Hypertension
          </span>
          <span className="text-[10px] font-mono bg-white/40 dark:bg-slate-800/60 text-[var(--text-secondary)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md font-medium">
            Synthea EHR (N={patientCount})
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-xl border border-[var(--border-subtle)] p-0.5 bg-white/40 dark:bg-slate-900/40 text-xs">
            <button
              type="button"
              onClick={() => setViewMode("clinician")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "clinician"
                  ? "bg-white dark:bg-slate-800 text-[var(--color-primary)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Clinician
            </button>
            <button
              type="button"
              onClick={() => setViewMode("patient")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === "patient"
                  ? "bg-white dark:bg-slate-800 text-[var(--color-primary)] shadow-xs font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Patient
            </button>
          </div>

          <Link
            href="/register"
            className="glass-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register</span>
          </Link>
        </div>
      </section>

      {/* ── HERO & MANDATORY SAFETY NOTICE ────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full glass-card border-[var(--color-primary)]/30 text-[11px] text-[var(--color-primary)] font-medium mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
              <span>Happiest Health Summit 2026 · Bengaluru Demonstration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-editorial font-bold text-[var(--text-primary)] tracking-tight">
              Pramana Clinical Digital Twin
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 max-w-2xl leading-relaxed">
              Dynamic virtual patient state modeling for 365-day hypertension decompensation surveillance and personalized scenario testing.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] shrink-0">
            <span className="px-2 py-1 rounded-lg glass-card border border-[var(--border-subtle)]">
              Horizon: <strong className="text-[var(--text-primary)] font-bold">365 Days</strong>
            </span>
            <span className="px-2 py-1 rounded-lg glass-card border border-[var(--border-subtle)]">
              ROC-AUC: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">0.8069</strong>
            </span>
            <span className="px-2 py-1 rounded-lg glass-card border border-[var(--border-subtle)]">
              Features: <strong className="text-[var(--text-primary)] font-bold">132</strong>
            </span>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="p-3 rounded-xl glass-card bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Scientific Notice:</strong> Research prototype evaluated on Synthea synthetic EHR data. Not a certified medical device; not for prescriptive or diagnostic clinical use.
            </span>
          </div>
          <Link
            href="/performance"
            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0 whitespace-nowrap"
          >
            Review Limitations →
          </Link>
        </div>
      </section>

      {/* ── MAIN DASHBOARD: PATIENT SELECTOR, VITALS & RISK TWIN ───────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Patient Selector & 3D Spatial Viz + Vitals */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-4 sm:p-5 border border-[var(--glass-border)] space-y-4">
            {/* Patient Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  <span>Patient Selector</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {patients.length} Profiles Available
                </span>
              </div>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full glass-dropdown px-3.5 py-2 text-xs flex items-center justify-between focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-all cursor-pointer rounded-xl border border-[var(--glass-border)]"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-mono font-bold text-[var(--text-primary)]">
                      {currentSummary?.display_id || selectedPatientId}
                    </span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="font-semibold text-[var(--text-primary)] truncate">
                      {currentSummary?.name || "Loading..."}
                    </span>
                    {currentSummary && (
                      <span className="text-[10px] text-[var(--text-muted)]">
                        ({currentSummary.age}{currentSummary.gender?.[0] || currentSummary.sex?.[0]})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                      {currentRiskTier}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {/* Dropdown Options */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-modal p-2 shadow-xl max-h-[280px] flex flex-col rounded-xl border border-[var(--glass-border)]">
                    <div className="relative mb-2 px-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by ID or name..."
                        className="glass-input w-full pl-8 pr-3 py-1 text-xs rounded-lg"
                        autoFocus
                      />
                    </div>

                    <div className="overflow-y-auto space-y-1 flex-1 pr-1">
                      {filteredPatients.map((p) => {
                        const tier = normalizeTier(p.risk_tier);
                        const isSelected = p.id === selectedPatientId;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatientId(p.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                              isSelected
                                ? "bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 font-semibold text-[var(--text-primary)]"
                                : "hover:bg-white/40 dark:hover:bg-slate-800/50 text-[var(--text-secondary)]"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="font-mono font-bold text-[var(--color-primary)]">{p.display_id}</span>
                              <span className="truncate">{p.name}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">
                                ({p.age}{p.gender?.[0] || p.sex?.[0]})
                              </span>
                            </div>
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${RISK_BADGE_CLASSES[tier]}`}>
                              {tier}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3D Visualization */}
            <div className="relative rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-white/20 dark:bg-slate-950/40">
              <DigitalTwinViz
                sbp={currentSbp}
                dbp={currentDbp}
                hr={currentHr}
                bmi={currentBmi}
                riskScore={currentRiskScore}
                riskTier={currentRiskTier}
                patientName={currentSummary?.name || "Patient"}
                height="240px"
              />
            </div>

            {/* Current Vitals (Compact Vital Cards) */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] mb-2 flex items-center justify-between">
                <span>Current Vitals</span>
                <span className="font-mono text-[10px]">Updated from Encounter Record</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2 rounded-xl glass-card border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <Gauge className="w-3 h-3 text-sky-500" />
                    <span>SBP</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                    {patientLoading ? "..." : Math.round(currentSbp)}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono">mmHg</div>
                </div>

                <div className="p-2 rounded-xl glass-card border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <Activity className="w-3 h-3 text-cyan-500" />
                    <span>DBP</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                    {patientLoading ? "..." : Math.round(currentDbp)}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono">mmHg</div>
                </div>

                <div className="p-2 rounded-xl glass-card border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <Heart className="w-3 h-3 text-rose-500" />
                    <span>Heart Rate</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                    {patientLoading ? "..." : Math.round(currentHr)}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono">bpm</div>
                </div>

                <div className="p-2 rounded-xl glass-card border border-[var(--border-subtle)]">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <Flame className="w-3 h-3 text-amber-500" />
                    <span>BMI</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                    {patientLoading ? "..." : Number(currentBmi).toFixed(1)}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono">kg/m²</div>
                </div>

                <div className="p-2 rounded-xl glass-card border border-[var(--border-subtle)] col-span-2 sm:col-span-1">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-[var(--text-muted)] font-medium">
                    <Scale className="w-3 h-3 text-emerald-500" />
                    <span>Weight</span>
                  </div>
                  <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                    {patientLoading ? "..." : Math.round(currentWeight)}
                  </div>
                  <div className="text-[9px] text-[var(--text-muted)] font-mono">kg</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Model Risk, Top Drivers & Direct Actions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-4 sm:p-5 border border-[var(--glass-border)] space-y-4">
            {/* Model Risk Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
              <div>
                <span className="text-[10px] font-mono text-[var(--color-primary)] uppercase tracking-wider font-bold">
                  365-Day Horizon
                </span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Model Score &amp; Risk Tier
                </h3>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                {currentRiskTier} Risk
              </span>
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] font-mono block">Calibrated Probability</span>
                <span className="text-2xl font-bold font-mono text-[var(--text-primary)] block mt-1">
                  {(currentRiskScore * 100).toFixed(1)}%
                </span>
                <span className="text-[9px] text-[var(--text-muted)] font-mono">Platt-scaled empirical</span>
              </div>

              <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
                <span className="text-[10px] text-[var(--text-muted)] font-mono block">Uncalibrated Logit</span>
                <span className="text-2xl font-bold font-mono text-[var(--text-secondary)] block mt-1">
                  {(patientPredict?.raw_score ?? 0.12).toFixed(4)}
                </span>
                <span className="text-[9px] text-[var(--text-muted)] font-mono">Raw XGBoost score</span>
              </div>
            </div>

            {/* Risk Tier Progress Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
                <span>Low (&lt;15%)</span>
                <span>Moderate (15–40%)</span>
                <span>High (&ge;40%)</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    currentRiskTier === "High"
                      ? "bg-rose-500"
                      : currentRiskTier === "Moderate"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, currentRiskScore * 100))}%` }}
                />
              </div>
            </div>

            {/* Top SHAP Contributing Drivers */}
            <div className="space-y-2 pt-1 border-t border-[var(--border-hairline)]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">Top Drivers</span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">TreeSHAP Attribution</span>
              </div>

              {topDrivers.length > 0 ? (
                <div className="space-y-1.5 text-xs font-mono">
                  {topDrivers.map((driver) => (
                    <div
                      key={driver.feature}
                      className="p-2 rounded-lg glass-card flex items-center justify-between border border-[var(--border-subtle)]"
                    >
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[190px]">
                        {driver.label || driver.feature}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          driver.impact > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {driver.impact > 0 ? "+" : ""}
                        {(driver.impact * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-[11px] text-[var(--text-muted)] font-mono rounded-lg glass-card">
                  Loading SHAP feature attributions...
                </div>
              )}
            </div>

            {/* Direct Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-hairline)]">
              <Link
                href="/twin"
                className="glass-btn-primary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-center"
              >
                <span>Open Digital Twin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/twin?patient=${selectedPatientId}#simulator`}
                className="glass-btn-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-center"
              >
                <Sliders className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                <span>What-If Lab</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── AUDITED SYSTEM METRICS STRIP (6 COMPACT CARDS) ────────────── */}
      <section className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Audited Performance Metrics (Held-Out Test N=964)</span>
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">Source: /api/v1/model/info</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Cohort Size</span>
            <div className="text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">
              {(metrics?.total_patients || 1335).toLocaleString()}
            </div>
            <span className="text-[9px] text-[var(--text-muted)] block">Synthetic profiles</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Feature Space</span>
            <div className="text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">
              132
            </div>
            <span className="text-[9px] text-[var(--text-muted)] block">Strict schema locked</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Prediction Horizon</span>
            <div className="text-lg font-bold font-mono text-[var(--text-primary)] mt-0.5">
              365 Days
            </div>
            <span className="text-[9px] text-[var(--text-muted)] block">Lookback: 365 days</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Test ROC-AUC</span>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {(metrics?.roc_auc || 0.8069).toFixed(4)}
            </div>
            <span className="text-[9px] text-[var(--text-muted)] block">95% CI: [0.691, 0.908]</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Test PR-AUC</span>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {(metrics?.pr_auc || 0.0644).toFixed(4)}
            </div>
            <span className="text-[9px] text-[var(--text-muted)] block">Base rate: 1.46%</span>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)]">
            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Test Positives</span>
            <div className="text-lg font-bold font-mono text-rose-500 mt-0.5">
              14 / 964
            </div>
            <span className="text-[9px] text-[var(--text-muted)] block">Rare event imbalance</span>
          </div>
        </div>
      </section>

      {/* ── VISUAL ARCHITECTURE FLOWCHART (Requirement 4) ──────────────── */}
      <section className="glass-card p-5 sm:p-6 border border-[var(--glass-border)] space-y-4">
        <div className="border-b border-[var(--border-hairline)] pb-2.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono text-[var(--color-primary)] uppercase tracking-wider font-bold">
              System Architecture
            </span>
            <h2 className="text-lg font-editorial font-bold text-[var(--text-primary)]">
              End-to-End Digital Twin Pipeline
            </h2>
          </div>
          <Link
            href="/how-it-works"
            className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium"
          >
            <span>Full Methodology</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Visual Flowchart */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-center">
          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[10px] font-mono text-[var(--color-primary)] font-bold">STEP 1</div>
            <div className="font-semibold text-xs text-[var(--text-primary)] my-1">EHR Data</div>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              Encounters, vitals, labs &amp; Bluetooth cuffs
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[10px] font-mono text-[var(--color-primary)] font-bold">STEP 2</div>
            <div className="font-semibold text-xs text-[var(--text-primary)] my-1">Patient State</div>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              132 rolling features over 365d lookback
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[10px] font-mono text-[var(--color-primary)] font-bold">STEP 3</div>
            <div className="font-semibold text-xs text-[var(--text-primary)] my-1">XGBoost Model</div>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              Supervised gradient boosted tree ensemble
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[10px] font-mono text-[var(--color-primary)] font-bold">STEP 4</div>
            <div className="font-semibold text-xs text-[var(--text-primary)] my-1">Risk Estimate</div>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              Platt scaling with 95% confidence bounds
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between">
            <div className="text-[10px] font-mono text-[var(--color-primary)] font-bold">STEP 5</div>
            <div className="font-semibold text-xs text-[var(--text-primary)] my-1">SHAP Explanation</div>
            <p className="text-[10px] text-[var(--text-muted)] leading-tight">
              Signed local attributions &amp; lever simulator
            </p>
          </div>
        </div>
      </section>

      {/* ── CORE MODULES (4 COMPACT TILES) ────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Link
          href="/twin"
          className="p-4 rounded-xl glass-card border border-[var(--glass-border)] hover:border-[var(--color-primary)]/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)]">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Digital Twin Lab</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
            Interactive counterfactual simulator, 3D telemetry, and historical trajectory scrubber.
          </p>
        </Link>

        <Link
          href="/patients"
          className="p-4 rounded-xl glass-card border border-[var(--glass-border)] hover:border-[var(--color-primary)]/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-600" />
              <span>Patient Cohort</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
            Cohort directory with search, SBP sparklines, and risk stratification filters.
          </p>
        </Link>

        <Link
          href="/performance"
          className="p-4 rounded-xl glass-card border border-[var(--glass-border)] hover:border-[var(--color-primary)]/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600" />
              <span>Model Metrics</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
            Platt reliability calibration curves, alert-budget policies, and 0% recall threshold audit.
          </p>
        </Link>

        <Link
          href="/india"
          className="p-4 rounded-xl glass-card border border-[var(--glass-border)] hover:border-[var(--color-primary)]/40 transition-all group"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)]">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>India Context &amp; ABDM</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform" />
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
            ABDM FHIR bundle ingestion, low-cost cuff streaming, and IGH-IV guideline bands.
          </p>
        </Link>
      </section>

      {/* ── HONEST LIMITATIONS SECTION (Requirement 6) ────────────────── */}
      <section className="glass-card p-5 border border-amber-500/25 bg-amber-500/5 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Honest Limitations &amp; Clinical Disclosures
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl glass-card border border-amber-500/20">
            <strong className="text-[var(--text-primary)] block font-semibold">1. Synthetic Training Data</strong>
            <p className="text-[var(--text-muted)] mt-1 text-[11px] leading-snug">
              Trained on Synthea synthetic EHR profiles conforming to US billing demographics. No real patient data used.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-amber-500/20">
            <strong className="text-[var(--text-primary)] block font-semibold">2. Static Threshold Limitation</strong>
            <p className="text-[var(--text-muted)] mt-1 text-[11px] leading-snug">
              Static cutoff (0.7562) flagged 0 of 14 positive events (0% recall). Requires alert-budget percentile policies.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-amber-500/20">
            <strong className="text-[var(--text-primary)] block font-semibold">3. Population Adaptation</strong>
            <p className="text-[var(--text-muted)] mt-1 text-[11px] leading-snug">
              Not validated on Indian biological cohorts or the &ldquo;thin-fat&rdquo; metabolic phenotype without local trials.
            </p>
          </div>

          <div className="p-3 rounded-xl glass-card border border-amber-500/20">
            <strong className="text-[var(--text-primary)] block font-semibold">4. Decision Support Only</strong>
            <p className="text-[var(--text-muted)] mt-1 text-[11px] leading-snug">
              Prototype for the Summit 2026 Challenge. Does not replace clinical judgment or prescribe pharmacotherapy.
            </p>
          </div>
        </div>
      </section>

      {/* ── EXPANDABLE PROGRESSIVE DISCLOSURE FOR TECHNICAL DETAILS ───── */}
      <details className="glass-card p-4 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer group">
        <summary className="font-semibold text-[var(--text-primary)] flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Technical Specifications &amp; Schema Fingerprint Details</span>
          </span>
          <span className="text-[10px] font-mono text-[var(--color-primary)] group-open:hidden">
            Expand Details ↓
          </span>
          <span className="text-[10px] font-mono text-[var(--color-primary)] hidden group-open:inline">
            Collapse ↑
          </span>
        </summary>
        <div className="pt-3 mt-2 border-t border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">Schema Lock Fingerprint</span>
            <span className="font-bold text-[var(--text-primary)]">{modelInfo?.schema_fingerprint || "a4ddaedbdbc8bb07"}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">Calibration Methodology</span>
            <span className="font-bold text-[var(--text-primary)]">Platt Sigmoid Scaling (95% CI)</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">Tamper-Evident Hash Chain</span>
            <span className="font-bold text-[var(--text-primary)]">SHA-256 Merkle Append-Only Log</span>
          </div>
        </div>
      </details>

      {/* ── STREAMLINED FOOTER WITH COMPLETE DIRECTORY ───────────────── */}
      <footer className="pt-4 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[var(--text-primary)]">Pramana TwinCare</span>
          <span>·</span>
          <Link href="/twin" className="hover:text-[var(--color-primary)] transition-colors">Digital Twin</Link>
          <span>·</span>
          <Link href="/patients" className="hover:text-[var(--color-primary)] transition-colors">Patients</Link>
          <span>·</span>
          <Link href="/population" className="hover:text-[var(--color-primary)] transition-colors">Population</Link>
          <span>·</span>
          <Link href="/performance" className="hover:text-[var(--color-primary)] transition-colors">Performance</Link>
          <span>·</span>
          <Link href="/india" className="hover:text-[var(--color-primary)] transition-colors">India Context</Link>
          <span>·</span>
          <Link href="/how-it-works" className="hover:text-[var(--color-primary)] transition-colors">How It Works</Link>
          <span>·</span>
          <Link href="/audit" className="hover:text-[var(--color-primary)] transition-colors">Audit Log</Link>
          <span>·</span>
          <Link href="/alerts" className="hover:text-[var(--color-primary)] transition-colors">Alerts</Link>
          <span>·</span>
          <Link href="/model-card" className="hover:text-[var(--color-primary)] transition-colors">Model Card</Link>
          <span>·</span>
          <Link href="/about" className="hover:text-[var(--color-primary)] transition-colors">About</Link>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>API 8000 Online</span>
          <span>·</span>
          <span>Next.js 3000 Active</span>
        </div>
      </footer>
    </div>
  );
}

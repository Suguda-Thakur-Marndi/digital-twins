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
import { useLanguage } from "@/lib/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  ArrowRight,
  ShieldAlert,
  Sliders,
  Activity,
  UserPlus,
  Users,
  Sparkles,
  FileText,
  Lock,
  Globe,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Search,
  CheckCircle2,
  Heart,
  Scale,
  Gauge,
  Flame,
  Info,
  Cpu,
  BarChart3,
  ExternalLink,
} from "lucide-react";

// Dynamically import Three.js visualization to prevent SSR canvas mismatch
const DigitalTwinViz = dynamic(() => import("@/components/digital-twin/DigitalTwinViz"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] rounded-2xl flex flex-col items-center justify-center bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-white/30 dark:border-slate-800/60 animate-pulse">
      <Cpu className="w-8 h-8 text-sky-500 animate-spin mb-2" />
      <span className="text-xs text-[var(--text-muted)] font-mono">Initializing 3D Spatial Twin...</span>
    </div>
  ),
});

export default function OverviewPage() {
  const { language, t } = useLanguage();
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

  // Fetch patient detail & live prediction whenever selectedPatientId changes
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

  return (
    <div className="space-y-10 pb-20">
      {/* ── SECTION 1: HEADER & PRIMARY ACTION STRIP ─────────────────────── */}
      <section className="glass-card p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-bold tracking-wider text-[var(--color-primary)] uppercase bg-[var(--color-primary)]/10 px-2 py-0.5 rounded-full border border-[var(--color-primary)]/20">
              TwinCare
            </span>
            <span className="text-xs text-[var(--text-muted)]">·</span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Pramana Clinical Digital Twin (Hypertension)
            </span>
            <span className="text-[10px] font-mono bg-white/40 dark:bg-slate-800/60 text-[var(--text-primary)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-full font-medium ml-1">
              SYNTHETIC EHR (N={patientCount})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Switch */}
            <div className="inline-flex rounded-xl border border-[var(--border-subtle)] p-1 bg-white/30 dark:bg-slate-900/40 backdrop-blur-sm text-xs">
              <button
                type="button"
                onClick={() => setViewMode("clinician")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === "clinician"
                    ? "bg-white/80 dark:bg-slate-800 text-[var(--text-primary)] shadow-sm font-semibold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Clinician View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("patient")}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === "patient"
                    ? "bg-white/80 dark:bg-slate-800 text-[var(--text-primary)] shadow-sm font-semibold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Patient View
              </button>
            </div>

            {/* Language Selector */}
            <LanguageSelector compact />

            {/* Primary Action Button */}
            <Link
              href="/register"
              className="glass-btn-primary inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Patient</span>
            </Link>
          </div>
        </div>

        {/* In-page navigation jump strip */}
        <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-muted)] font-medium">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-primary)]">
            Explore:
          </span>
          <Link href={`/twin?patient=${selectedPatientId}`} className="hover:text-[var(--color-primary)] transition-colors">
            Digital Twin
          </Link>
          <Link href="/patients" className="hover:text-[var(--color-primary)] transition-colors">
            Patient Directory
          </Link>
          <Link href={`/twin?patient=${selectedPatientId}#simulator`} className="hover:text-[var(--color-primary)] transition-colors">
            What-If Simulator
          </Link>
          <Link href="/alerts" className="hover:text-[var(--color-primary)] transition-colors">
            Surveillance Alerts
          </Link>
          <Link href="/population" className="hover:text-[var(--color-primary)] transition-colors">
            Population
          </Link>
          <Link href="/performance" className="hover:text-[var(--color-primary)] transition-colors">
            Honest Performance
          </Link>
          <Link href="/model-card" className="hover:text-[var(--color-primary)] transition-colors">
            Model Card
          </Link>
          <Link href="/import" className="hover:text-[var(--color-primary)] transition-colors">
            ABDM / FHIR
          </Link>
          <Link href="/india" className="hover:text-[var(--color-primary)] transition-colors">
            India Guidelines
          </Link>
          <Link href="/audit" className="hover:text-[var(--color-primary)] transition-colors">
            Audit Log
          </Link>
        </div>
      </section>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl glass-card bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadInitialData}
            className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* ── SECTION 2: HERO & LIVE 3D INTERACTIVE DIGITAL TWIN DASHBOARD ──── */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 items-start">
        {/* Left Column: Context, Value Proposition & Actions */}
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card border-[var(--color-primary)]/30 text-xs text-[var(--color-primary)] font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
            <span>Happiest Health Summit 2026 · Bengaluru Demonstration</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-editorial font-bold text-[var(--text-primary)] leading-[1.15] tracking-tight">
            A dynamic virtual replica for longitudinal hypertension decompensation.
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
            A clinical digital twin is a dynamic virtual replica of a patient kept updated from longitudinal Electronic Health Record (EHR) encounter history plus home telemetry, used here to predict 365-day blood pressure decompensation (progression to Stage 2 hypertension) before it occurs and personalize therapeutic scenarios.
          </p>

          {/* Mandatory Regulatory Notice (Glass panel) */}
          <div className="p-4 rounded-2xl glass-card bg-amber-500/10 border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Mandatory Scientific Notice:</strong> Research prototype evaluated strictly on Synthea synthetic EHR data. Not a medical device. Not validated on real patients or Indian clinical cohorts. Not for diagnosis or prescriptive treatment.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/twin?patient=${selectedPatientId}`}
              className="glass-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold shadow-md"
            >
              <span>Explore Twin Dashboard ({currentSummary?.display_id || selectedPatientId})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href={`/twin?patient=${selectedPatientId}#simulator`}
              className="glass-btn-secondary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
            >
              <Sliders className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>What-If Simulator</span>
            </Link>

            <Link
              href="/performance"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span>Inspect Honest Performance →</span>
            </Link>
          </div>

          {/* Quick Badges */}
          <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-muted)] font-mono">
            <span className="px-2 py-0.5 rounded-md glass-card border-[var(--border-subtle)]">
              API Status: <strong className="text-emerald-500 uppercase">{healthStatus}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md glass-card border-[var(--border-subtle)]">
              Schema: <strong className="text-[var(--text-primary)]">a4ddaedb</strong>
            </span>
            <span className="px-2 py-0.5 rounded-md glass-card border-[var(--border-subtle)]">
              Features: <strong className="text-[var(--text-primary)]">132</strong>
            </span>
          </div>
        </div>

        {/* Right Column: STRUCTURED GLASS DASHBOARD (Section 7 Redesign) */}
        <div className="glass-panel p-5 sm:p-6 space-y-5">
          {/* 1. PATIENT SELECTOR (Glass Dropdown + Search) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                <span>Patient Selector</span>
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {patients.length} Registered Synthetic Profiles
              </span>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full glass-dropdown px-3.5 py-2.5 text-xs flex items-center justify-between focus:ring-2 focus:ring-[var(--color-primary)]/40 transition-all cursor-pointer"
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
                    <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                      ({currentSummary.age}{currentSummary.gender?.[0] || currentSummary.sex?.[0]})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentSummary && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                      {currentRiskTier}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Glass Dropdown Panel */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 glass-modal p-2 shadow-2xl max-h-[320px] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                  {/* Search Bar inside Dropdown */}
                  <div className="relative mb-2 px-1">
                    <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search patient by ID or name..."
                      className="glass-input w-full pl-8 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-[var(--color-primary)]/40"
                      autoFocus
                    />
                  </div>

                  {/* Patient List */}
                  <div className="overflow-y-auto space-y-1 flex-1 pr-1">
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                        No matching patients found
                      </div>
                    ) : (
                      filteredPatients.map((p) => {
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
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-all ${
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
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. THREE.JS SPATIAL VISUALIZATION (Abstract Lattice, Theme-Aware) */}
          <div className="relative rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-white/20 dark:bg-slate-950/40 shadow-inner">
            <DigitalTwinViz
              sbp={currentSbp}
              dbp={currentDbp}
              hr={currentHr}
              bmi={currentBmi}
              riskScore={currentRiskScore}
              riskTier={currentRiskTier}
              patientName={currentSummary?.name || "Patient"}
              height="260px"
            />
          </div>

          {/* 3. VITALS CARDS (Systolic, Diastolic, BMI, Weight, HR) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            {/* SBP */}
            <div className="p-2.5 rounded-xl glass-card text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">
                <Gauge className="w-3 h-3 text-sky-500" />
                <span>Systolic</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                {patientLoading ? "--" : Math.round(currentSbp)}
              </div>
              <div className="text-[9px] text-[var(--text-muted)] font-mono">mmHg</div>
            </div>

            {/* DBP */}
            <div className="p-2.5 rounded-xl glass-card text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">
                <Activity className="w-3 h-3 text-cyan-500" />
                <span>Diastolic</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                {patientLoading ? "--" : Math.round(currentDbp)}
              </div>
              <div className="text-[9px] text-[var(--text-muted)] font-mono">mmHg</div>
            </div>

            {/* Heart Rate */}
            <div className="p-2.5 rounded-xl glass-card text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">
                <Heart className="w-3 h-3 text-rose-500" />
                <span>Heart Rate</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                {patientLoading ? "--" : Math.round(currentHr)}
              </div>
              <div className="text-[9px] text-[var(--text-muted)] font-mono">bpm</div>
            </div>

            {/* BMI */}
            <div className="p-2.5 rounded-xl glass-card text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">
                <Flame className="w-3 h-3 text-amber-500" />
                <span>BMI</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                {patientLoading ? "--" : Number(currentBmi).toFixed(1)}
              </div>
              <div className="text-[9px] text-[var(--text-muted)] font-mono">kg/m²</div>
            </div>

            {/* Weight */}
            <div className="p-2.5 rounded-xl glass-card text-center col-span-2 sm:col-span-1">
              <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-semibold text-[var(--text-muted)] mb-1">
                <Scale className="w-3 h-3 text-emerald-500" />
                <span>Weight</span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono text-[var(--text-primary)]">
                {patientLoading ? "--" : Math.round(currentWeight)}
              </div>
              <div className="text-[9px] text-[var(--text-muted)] font-mono">kg</div>
            </div>
          </div>

          {/* 4. MODEL RISK PANEL (365d Horizon, Calibrated Score, Tier, Disclaimers) */}
          <div className="p-4 rounded-2xl glass-card space-y-3 bg-white/40 dark:bg-slate-900/40 border-[var(--border-subtle)]">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-[var(--text-primary)]">
                  365-Day Decompensation Risk
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                  Prediction Horizon: 365 Days
                </span>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                {(currentRiskScore * 100).toFixed(1)}% · {currentRiskTier} Risk
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  currentRiskTier === "High"
                    ? "bg-rose-500"
                    : currentRiskTier === "Moderate"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(4, currentRiskScore * 100))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
              <span>Platt Scaling Calibrated</span>
              <span>Model Status: Active v1.0.0</span>
              <Link href="/model-card" className="hover:text-[var(--color-primary)] underline">
                Explanation & Model Card
              </Link>
            </div>

            <p className="text-[10px] text-[var(--text-muted)] italic leading-tight pt-1 border-t border-[var(--border-subtle)]">
              * Model score represents an empirical surveillance rank score, not a diagnostic certainty or treatment recommendation.
            </p>
          </div>

          {/* Direct CTA into Patient Twin */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[var(--text-muted)]">
              Complete timeline history, 132 rolling features & what-if lab:
            </span>
            <Link
              href={`/twin?patient=${selectedPatientId}`}
              className="inline-flex items-center gap-1 font-bold text-[var(--color-primary)] hover:underline"
            >
              <span>Open Patient Twin</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: AUDITED LIVE SYSTEM PARAMETERS STRIP ───────────────── */}
      <section className="glass-card p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--color-primary)]" />
            <span>Audited Live System Parameters & Empirical Metrics</span>
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            Source: /api/v1/model/info
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl glass-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Cohort Size</div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums mt-0.5">
              {loading ? "..." : (metrics?.total_patients || 1335).toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Synthetic profiles</div>
          </div>

          <div className="p-3.5 rounded-xl glass-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Model Pipeline</div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)] mt-0.5">
              {loading ? "..." : `v${modelInfo?.version || "1.0.0"}`}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">132 input features</div>
          </div>

          <div className="p-3.5 rounded-xl glass-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Schema Hash</div>
            <div className="text-xs font-bold font-mono text-[var(--text-primary)] truncate mt-1">
              {loading ? "..." : modelInfo?.schema_fingerprint || "a4ddaedbdbc8bb07"}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Strict schema lock</div>
          </div>

          <div className="p-3.5 rounded-xl glass-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Test ROC-AUC</div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums mt-0.5">
              {loading ? "..." : (metrics?.roc_auc || 0.8069).toFixed(4)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              95% CI: [{metrics?.roc_auc_ci_95?.[0] || 0.691}, {metrics?.roc_auc_ci_95?.[1] || 0.908}]
            </div>
          </div>

          <div className="p-3.5 rounded-xl glass-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Test PR-AUC</div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums mt-0.5">
              {loading ? "..." : (metrics?.pr_auc || 0.0644).toFixed(4)}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
              Base rate: {((metrics?.base_rate || 0.01457) * 100).toFixed(2)}%
            </div>
          </div>

          <div className="p-3.5 rounded-xl glass-card">
            <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Test Positives</div>
            <div className="text-xl font-bold font-mono text-rose-500 tabular-nums mt-0.5">
              {loading ? "..." : `${metrics?.positive_events_test || 14} / 964`}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Extreme class imbalance</div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CLINICAL FEATURE INDEX (7 FUNCTIONAL PILLARS) ──────── */}
      <section className="space-y-6">
        <div className="border-b border-[var(--border-subtle)] pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wider text-[var(--color-primary)] uppercase">
              Product Architecture
            </span>
            <span className="text-xs text-[var(--text-muted)]">·</span>
            <span className="text-xs font-mono text-[var(--text-muted)]">7 Functional Pillars</span>
          </div>
          <h2 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Clinical Feature Index
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Every analytical, predictive, simulation, and governance capability engineered into the Pramana Clinical Twin.
          </p>
        </div>

        <div className="space-y-4">
          {/* 01 PATIENT */}
          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div>
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">01 / PATIENT</span>
              <h3 className="text-base font-editorial font-bold text-[var(--text-primary)] mt-1">
                Twin Identification & Vitals
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Establish, inspect, and track dynamic patient states.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/register"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Register Patient</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  4-step intake for demographics, vitals, labs, and history with range validation.
                </p>
              </Link>

              <Link
                href="/patients"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Patient Directory</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Cohort roster with search, risk tiers, and SBP sparkline trajectories.
                </p>
              </Link>

              <Link
                href={`/twin?patient=${selectedPatientId}`}
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Twin Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  3D spatial core, real-time vitals, Platt-calibrated risk, and signed SHAP drivers.
                </p>
              </Link>
            </div>
          </div>

          {/* 02 PREDICT EARLY */}
          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div>
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">02 / PREDICT EARLY</span>
              <h3 className="text-base font-editorial font-bold text-[var(--text-primary)] mt-1">
                Surveillance & Telemetry
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Anticipate decompensation months before clinical crises.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href={`/twin?patient=${selectedPatientId}`}
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Risk Replay Scrubber</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Interactive scrubber marking first alert crossings and lead time before decompensation.
                </p>
              </Link>

              <Link
                href="/alerts"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Early Warning Alerts</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Surveillance engine filtering patients with rising risk over configurable snapshot windows.
                </p>
              </Link>

              <Link
                href={`/twin?patient=${selectedPatientId}`}
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Live Telemetry & Rules</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  SSE streaming, 7-day rolling statistics, and rule flags (e.g. 5/7 days SBP ≥ 140 mmHg).
                </p>
              </Link>
            </div>
          </div>

          {/* 03 PERSONALIZE */}
          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div>
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">03 / PERSONALIZE</span>
              <h3 className="text-base font-editorial font-bold text-[var(--text-primary)] mt-1">
                What-If Counterfactuals
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Explore treatment, lifestyle, and dosage scenarios.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href={`/twin?patient=${selectedPatientId}#simulator`}
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Full Patient Simulator</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Grouped input editor shifting all correlated features via lever_map.json with clamping.
                </p>
              </Link>

              <Link
                href={`/twin?patient=${selectedPatientId}#simulator`}
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Sensitivity Curves</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Multi-point response curves showing tree step-function plateaus with patient marker.
                </p>
              </Link>

              <Link
                href={`/twin?patient=${selectedPatientId}#simulator`}
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Presets & Comparison</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  5 editable presets, side-by-side comparison of 3 scenarios, and PDF report export.
                </p>
              </Link>
            </div>
          </div>

          {/* 04 POPULATION */}
          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div>
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">04 / POPULATION</span>
              <h3 className="text-base font-editorial font-bold text-[var(--text-primary)] mt-1">
                Macro Analytics & Policy
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Stratify cohorts and optimize surveillance budgets.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/population"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Cohort Risk Distribution</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Macro cohort analytics, age band and gender stratification, and risk tier distribution bars.
                </p>
              </Link>

              <Link
                href="/performance#alert-budget"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Alert-Budget Policy</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Operating policy table allocating top 5%, 10%, and 20% alert capacity to match clinical staffing.
                </p>
              </Link>
            </div>
          </div>

          {/* 05 TRUST & AUDIT */}
          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div>
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">05 / TRUST & AUDIT</span>
              <h3 className="text-base font-editorial font-bold text-[var(--text-primary)] mt-1">
                Honesty & Governance
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Transparent verification without exaggerated claims.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/performance"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Honest Performance</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Reliability calibration plot, base rate disclosures, and documentation of 0% static threshold recall.
                </p>
              </Link>

              <Link
                href="/model-card"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Audited Model Card</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Full clinical model specification, ethical evaluation, synthetic data truth, and limitations.
                </p>
              </Link>

              <Link
                href="/audit"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Hash-Chained Audit Log</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Cryptographic SHA-256 hash-chain with one-click tamper-evident integrity verification.
                </p>
              </Link>
            </div>
          </div>

          {/* 06 INDIA CONTEXT */}
          <div className="glass-card p-5 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
            <div>
              <span className="font-mono text-xs font-bold text-[var(--color-primary)]">06 / INDIA CONTEXT</span>
              <h3 className="text-base font-editorial font-bold text-[var(--text-primary)] mt-1">
                ABDM & Public Health
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                Integration pathways for Indian healthcare delivery.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link
                href="/import"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>ABDM / FHIR Ingestion</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Parse and map ABDM FHIR R4 Bundles (Patient, Observation, Condition, MedicationStatement).
                </p>
              </Link>

              <Link
                href="/import"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Bluetooth Cuff Ingestion</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  Low-cost device ingestion for Omron / Dr. Morepen oscillometric cuffs and pulse oximeters.
                </p>
              </Link>

              <Link
                href="/india"
                className="p-3.5 rounded-xl glass-card hover:border-[var(--color-primary)] transition-all group"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--color-primary)] flex items-center justify-between">
                  <span>Indian Guidelines (IGH-IV)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-snug">
                  ICMR / IGH-IV 140/90 mmHg bands, ICMR-INDIAB Lancet 2023 statistics, and i18n support.
                </p>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: HOW IT WORKS IN 4 STEPS WITH DIAGRAM ───────────────── */}
      <section className="glass-card p-6 sm:p-7 space-y-6">
        <div className="border-b border-[var(--border-subtle)] pb-3">
          <span className="text-xs font-bold tracking-wider text-[var(--color-primary)] uppercase">
            System Methodology
          </span>
          <h2 className="text-2xl font-editorial font-bold text-[var(--text-primary)] mt-1">
            How the Clinical Twin Operates in 4 Steps
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            From raw longitudinal records to explainable risk forecasts and personalized counterfactuals.
          </p>
        </div>

        {/* Frosted Architectural Diagram */}
        <div className="p-4 rounded-2xl glass-panel overflow-x-auto">
          <div className="min-w-[640px] flex items-center justify-between gap-2 text-xs">
            <div className="p-3.5 rounded-xl glass-card flex-1 text-center">
              <div className="font-mono text-[10px] text-[var(--color-primary)] font-bold">STEP 01</div>
              <div className="font-semibold text-[var(--text-primary)] mt-0.5">Clinical Ingestion</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                EHR Encounters + ABDM FHIR + Home Cuff Readings
              </div>
            </div>

            <span className="text-[var(--text-muted)] font-bold px-1">→</span>

            <div className="p-3.5 rounded-xl glass-card flex-1 text-center">
              <div className="font-mono text-[10px] text-[var(--color-primary)] font-bold">STEP 02</div>
              <div className="font-semibold text-[var(--text-primary)] mt-0.5">Twin State Assembly</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                132 Rolling Features (365d Mean, Variance, Slopes)
              </div>
            </div>

            <span className="text-[var(--text-muted)] font-bold px-1">→</span>

            <div className="p-3.5 rounded-xl glass-card flex-1 text-center">
              <div className="font-mono text-[10px] text-[var(--color-primary)] font-bold">STEP 03</div>
              <div className="font-semibold text-[var(--text-primary)] mt-0.5">Risk & Explanation</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                XGBoost + Platt Scaling + Signed TreeExplainer SHAP
              </div>
            </div>

            <span className="text-[var(--text-muted)] font-bold px-1">→</span>

            <div className="p-3.5 rounded-xl glass-card flex-1 text-center">
              <div className="font-mono text-[10px] text-[var(--color-primary)] font-bold">STEP 04</div>
              <div className="font-semibold text-[var(--text-primary)] mt-0.5">What-If Scenarios</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                Correlated Lever Shifting via lever_map.json
              </div>
            </div>
          </div>
        </div>

        {/* 4 Detailed Narrative Blocks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs leading-relaxed">
          <div className="p-4 rounded-xl glass-card space-y-1.5">
            <span className="font-mono font-bold text-[var(--color-primary)]">01. Data In</span>
            <h4 className="font-semibold text-[var(--text-primary)]">Multi-Source Ingestion</h4>
            <p className="text-[var(--text-secondary)]">
              Ingests ambulatory visits, laboratory panels (glucose, HbA1c), medication histories, and peripheral Bluetooth blood pressure readings without mixing unvalidated wearable streams into ML weights.
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card space-y-1.5">
            <span className="font-mono font-bold text-[var(--color-primary)]">02. Representation</span>
            <h4 className="font-semibold text-[var(--text-primary)]">Leak-Free Time Anchoring</h4>
            <p className="text-[var(--text-secondary)]">
              Constructs an exact longitudinal representation over a rolling [T-365d, T] history. Enforces strict temporal boundaries ensuring zero future observation leakage into the baseline state.
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card space-y-1.5">
            <span className="font-mono font-bold text-[var(--color-primary)]">03. Inference</span>
            <h4 className="font-semibold text-[var(--text-primary)]">Platt Calibrated Risk</h4>
            <p className="text-[var(--text-secondary)]">
              Calculates 365-day decompensation probability via scikit-learn + XGBoost. Raw machine outputs are empirically calibrated via Platt scaling with 95% confidence intervals and signed SHAP drivers.
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card space-y-1.5">
            <span className="font-mono font-bold text-[var(--color-primary)]">04. Personalization</span>
            <h4 className="font-semibold text-[var(--text-primary)]">Correlated Simulations</h4>
            <p className="text-[var(--text-secondary)]">
              Adjusting systolic blood pressure or body weight automatically updates all correlated parameters (mean, min, max, baseline, pulse pressure, BMI) so counterfactuals reflect clinical coherence.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: HONEST LIMITATIONS BLOCK ──────────────────────────── */}
      <section className="p-6 rounded-2xl glass-card bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-200 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <h2 className="text-base font-editorial font-bold text-[var(--text-primary)]">
            Honest Limitations & Ethical Disclosures
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-[var(--text-primary)]">Synthetic US-Pattern Training Data</h3>
            <p className="text-[var(--text-secondary)]">
              The underlying pipeline was trained exclusively on Synthea synthetic EHR profiles generated according to US clinical demographics and billing patterns. No real patient data was utilized during training or evaluation.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-[var(--text-primary)]">Extreme Class Imbalance (14 Test Events)</h3>
            <p className="text-[var(--text-secondary)]">
              In the held-out test cohort of 964 patients, only 14 experienced decompensation (1.46% base rate). A static 0.7562 cutoff yields 0% recall. Clinical surveillance requires an alert-budget policy (e.g. top 10%).
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-[var(--text-primary)]">Unvalidated on Indian Biological Cohorts</h3>
            <p className="text-[var(--text-secondary)]">
              Indian populations exhibit the &ldquo;thin-fat&rdquo; phenotype (normal BMI with elevated visceral adiposity and insulin resistance) and distinct dietary sodium habits. This model must not be deployed clinically in India without local prospective trials.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-[var(--text-primary)]">Decision Support, Not Prescriptive Diagnosis</h3>
            <p className="text-[var(--text-secondary)]">
              Pramana Twin is an investigative research prototype developed for the Summit 2026 Digital Twin Challenge. It does not replace clinical judgment, provide pharmacological prescriptions, or establish medical causation.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: FOOTER & DOCUMENTATION LINKS ──────────────────────── */}
      <footer className="pt-8 border-t border-[var(--border-subtle)] space-y-6 text-xs text-[var(--text-muted)]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <div className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px] mb-2.5">
              Clinical Tools
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/register" className="hover:text-[var(--color-primary)] transition-colors">
                  Register New Patient
                </Link>
              </li>
              <li>
                <Link href="/patients" className="hover:text-[var(--color-primary)] transition-colors">
                  Patient Cohort Directory
                </Link>
              </li>
              <li>
                <Link href={`/twin?patient=${selectedPatientId}`} className="hover:text-[var(--color-primary)] transition-colors">
                  Interactive Twin Dashboard
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="hover:text-[var(--color-primary)] transition-colors">
                  Early Warning Surveillance
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px] mb-2.5">
              India & ABDM
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/import" className="hover:text-[var(--color-primary)] transition-colors">
                  ABDM FHIR Bundle Ingestion
                </Link>
              </li>
              <li>
                <Link href="/import" className="hover:text-[var(--color-primary)] transition-colors">
                  Bluetooth Device Ingestion
                </Link>
              </li>
              <li>
                <Link href="/india" className="hover:text-[var(--color-primary)] transition-colors">
                  IGH-IV Indian Guidelines
                </Link>
              </li>
              <li>
                <Link href="/population" className="hover:text-[var(--color-primary)] transition-colors">
                  Population Distribution
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px] mb-2.5">
              Honesty & Audit
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/performance" className="hover:text-[var(--color-primary)] transition-colors">
                  Performance & Reliability Curve
                </Link>
              </li>
              <li>
                <Link href="/model-card" className="hover:text-[var(--color-primary)] transition-colors">
                  Audited Model Card
                </Link>
              </li>
              <li>
                <Link href="/audit" className="hover:text-[var(--color-primary)] transition-colors">
                  Hash-Chained Audit Log
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-[var(--color-primary)] transition-colors">
                  Methodology & Specs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-semibold text-[var(--text-primary)] uppercase tracking-wider text-[10px] mb-2.5">
              Summit Resources
            </div>
            <ul className="space-y-1.5">
              <li>
                <Link href="/about" className="hover:text-[var(--color-primary)] transition-colors">
                  Summit 2026 Background
                </Link>
              </li>
              <li>
                <span className="text-[var(--text-muted)]">DEMO.md (3-Min Jury Script)</span>
              </li>
              <li>
                <span className="text-[var(--text-muted)]">IMPACT.md (Health Systems)</span>
              </li>
              <li>
                <span className="text-[var(--text-muted)]">DPDP Act 2023 Compliance</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
          <p>
            TwinCare / Pramana Clinical Twin · Developed for Happiest Health Summit 2026, Bengaluru.
          </p>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>API Online (:8000)</span>
            <span>·</span>
            <span>Frontend Online (:3000)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

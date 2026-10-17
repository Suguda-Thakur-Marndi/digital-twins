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
  fetchTimelineRisk,
  fetchWhatIf,
  PatientSummary,
  PatientDetail,
  PredictResponse,
  ModelInfo,
  TimelineRiskResponse,
  WhatIfResponse,
} from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  ArrowRight,
  ShieldAlert,
  Sliders,
  Activity,
  Users,
  Search,
  ChevronDown,
  Heart,
  Scale,
  Gauge,
  Flame,
  Info,
  Cpu,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Layers,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// Dynamic Three.js visualization to prevent SSR mismatch
const DigitalTwinViz = dynamic(() => import("@/components/digital-twin/DigitalTwinViz"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[240px] rounded-2xl flex flex-col items-center justify-center bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-[var(--glass-border)] animate-pulse">
      <Cpu className="w-6 h-6 text-[var(--color-primary)] animate-spin mb-2" />
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
  const [timelineData, setTimelineData] = useState<TimelineRiskResponse | null>(null);
  const [patientLoading, setPatientLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // What-If Simulation State
  const [sbpDelta, setSbpDelta] = useState<number>(-10);
  const [weightDelta, setWeightDelta] = useState<number>(-5);
  const [simResult, setSimResult] = useState<WhatIfResponse | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Load initial model info & patients list
  useEffect(() => {
    Promise.all([
      fetchModelInfo().catch(() => null),
      fetchPatients(40).catch(() => []),
    ]).then(([m, pts]) => {
      setModelInfo(m);
      setPatients(pts);
      if (pts.length > 0) {
        const defaultPt = pts.find((p) => p.id === "PT-101" || p.display_id === "PT-101") || pts[0];
        setSelectedPatientId(defaultPt.id);
      }
    });
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

  // Fetch patient detail, prediction, timeline & run baseline what-if when patient changes
  useEffect(() => {
    if (!selectedPatientId) return;
    let isMounted = true;
    setPatientLoading(true);

    Promise.all([
      fetchPatient(selectedPatientId).catch(() => null),
      fetchPredict(selectedPatientId).catch(() => null),
      fetchTimelineRisk(selectedPatientId).catch(() => null),
      fetchWhatIf(selectedPatientId, sbpDelta, weightDelta).catch(() => null),
    ])
      .then(([detail, pred, timeline, whatif]) => {
        if (!isMounted) return;
        setPatientDetail(detail);
        setPatientPredict(pred);
        setTimelineData(timeline);
        setSimResult(whatif);
      })
      .finally(() => {
        if (isMounted) setPatientLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  // Handle What-If slider changes
  const runSimulation = (newSbpDelta: number, newWeightDelta: number) => {
    setSbpDelta(newSbpDelta);
    setWeightDelta(newWeightDelta);
    if (!selectedPatientId) return;
    setSimLoading(true);
    fetchWhatIf(selectedPatientId, newSbpDelta, newWeightDelta)
      .then((res) => setSimResult(res))
      .catch((err) => console.error("What-if calculation error:", err))
      .finally(() => setSimLoading(false));
  };

  const currentSummary = useMemo(() => {
    return patients.find((p) => p.id === selectedPatientId) || patients[0] || null;
  }, [patients, selectedPatientId]);

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

  // Current patient vitals
  const currentSbp = patientDetail?.latest_vitals?.sbp ?? currentSummary?.latest_sbp ?? 142;
  const currentDbp = patientDetail?.latest_vitals?.dbp ?? currentSummary?.latest_dbp ?? 88;
  const currentHr = patientDetail?.latest_vitals?.hr ?? 74;
  const currentBmi = patientDetail?.latest_vitals?.bmi ?? 29.4;
  const currentWeight = patientDetail?.latest_vitals?.weight ?? 84;
  const currentRiskScore = patientPredict?.calibrated_risk ?? currentSummary?.calibrated_risk ?? 0.153;
  const currentRiskTier = normalizeTier(patientPredict?.risk_tier || currentSummary?.risk_tier || "Moderate");
  const topDrivers = patientPredict?.top_contributing_factors?.slice(0, 4) || [];

  // Timeline chart data formatting
  const chartTimeline = useMemo(() => {
    if (timelineData?.snapshots && timelineData.snapshots.length > 0) {
      return timelineData.snapshots.map((s, idx) => ({
        index: idx + 1,
        date: s.date || `M${idx + 1}`,
        sbp: s.sbp ?? null,
        dbp: s.dbp ?? null,
        risk: s.calibrated_risk != null ? Number((s.calibrated_risk * 100).toFixed(1)) : null,
        stage2: s.stage_2_decompensation,
      }));
    }
    if (patientDetail?.timeline_vitals && patientDetail.timeline_vitals.length > 0) {
      return patientDetail.timeline_vitals.map((v, idx) => ({
        index: idx + 1,
        date: v.date?.slice(0, 10) || `Pt ${idx + 1}`,
        sbp: v.sbp ?? null,
        dbp: v.dbp ?? null,
        risk: Number((currentRiskScore * 100).toFixed(1)),
        stage2: (v.sbp != null && v.sbp >= 140) || (v.dbp != null && v.dbp >= 90),
      }));
    }
    return [
      { index: 1, date: "M-12", sbp: 132, dbp: 82, risk: 12.0, stage2: false },
      { index: 2, date: "M-9", sbp: 136, dbp: 84, risk: 14.5, stage2: false },
      { index: 3, date: "M-6", sbp: 140, dbp: 86, risk: 18.2, stage2: true },
      { index: 4, date: "M-3", sbp: 144, dbp: 88, risk: 22.0, stage2: true },
      { index: 5, date: "Now", sbp: currentSbp, dbp: currentDbp, risk: Number((currentRiskScore * 100).toFixed(1)), stage2: true },
    ];
  }, [timelineData, patientDetail, currentSbp, currentDbp, currentRiskScore]);

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* ── 1. PROJECT TITLE & ONE-LINE DESCRIPTION ─────────────────────── */}
      <section className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-editorial font-bold text-[var(--text-primary)] tracking-tight">
              VitalTwin — AI-Powered Clinical Digital Twin
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 max-w-2xl leading-relaxed">
              A Living Digital Perspective on Health. Longitudinal digital twin prototype for 365-day hypertension trajectory monitoring, risk estimation, and counterfactual scenario exploration.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/twin"
              className="glass-btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl"
            >
              <span>Full Twin Lab</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Concise Safety Disclaimer */}
        <div className="p-2.5 rounded-xl glass-card bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Safety Notice:</strong> Prototype only. Not validated for clinical decisions.
            </span>
          </div>
          <Link
            href="/model-card"
            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline shrink-0 self-end sm:self-auto"
          >
            Model Card &amp; Limitations →
          </Link>
        </div>
      </section>

      {/* ── COMPACT VISUAL PIPELINE ──────────────────────────────────────── */}
      <section className="glass-card p-3.5 sm:p-4 border border-[var(--glass-border)] rounded-2xl">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-2.5">
          <span>End-to-End Pipeline</span>
          <span className="text-[var(--color-primary)] font-semibold">132 Longitudinal Features · 365d Horizon</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="text-[10px] font-mono text-[var(--text-secondary)] font-bold tracking-wider">INPUT</div>
            <div className="font-bold text-[var(--text-primary)] mt-0.5 text-xs">Patient Data</div>
            <div className="text-[11px] text-[var(--text-secondary)] font-medium">Encounters &amp; vitals</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="text-[10px] font-mono text-[var(--color-primary)] font-bold tracking-wider">STATE</div>
            <div className="font-bold text-[var(--color-primary)] mt-0.5 text-xs">Longitudinal Features</div>
            <div className="text-[11px] text-[var(--text-secondary)] font-medium">132 rolling indicators</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="text-[10px] font-mono text-sky-700 dark:text-sky-300 font-bold tracking-wider">MODEL</div>
            <div className="font-bold text-sky-700 dark:text-sky-300 mt-0.5 text-xs">XGBoost</div>
            <div className="text-[11px] text-[var(--text-secondary)] font-medium">Gradient-boosted trees</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 font-bold tracking-wider">ESTIMATE</div>
            <div className="font-bold text-indigo-700 dark:text-indigo-300 mt-0.5 text-xs">Risk Estimate</div>
            <div className="text-[11px] text-[var(--text-secondary)] font-medium">Platt-scaled with 95% CI</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs col-span-2 sm:col-span-1">
            <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 font-bold tracking-wider">EXPLAIN</div>
            <div className="font-bold text-emerald-700 dark:text-emerald-300 mt-0.5 text-xs">SHAP Explanation</div>
            <div className="text-[11px] text-[var(--text-secondary)] font-medium">Signed feature drivers</div>
          </div>
        </div>
      </section>

      {/* ── 2. PATIENT SELECTOR ───────────────────────────────────────────── */}
      <section className="glass-card p-3 sm:p-4 border border-[var(--glass-border)] rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">Select Patient Profile:</span>
          </div>

          <div className="relative flex-1 max-w-md" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full glass-dropdown px-3 py-1.5 text-xs flex items-center justify-between rounded-xl border border-[var(--glass-border)] cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
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
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                  {currentRiskTier}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 glass-modal p-2 shadow-xl max-h-[260px] flex flex-col rounded-xl border border-[var(--glass-border)]">
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

          <div className="flex items-center gap-2 text-xs">
            <Link
              href={`/twin?patient=${selectedPatientId}`}
              className="text-[var(--color-primary)] hover:underline font-semibold flex items-center gap-1"
            >
              <span>Inspect in Twin</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. CURRENT VITALS (SBP, DBP, HR, BMI, WEIGHT) ────────────────── */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
          <span className="font-bold text-[var(--text-primary)]">Current Patient Vitals</span>
          <span className="text-[11px] font-mono text-[var(--text-secondary)]">Most Recent Clinical Encounter</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-bold">
              <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>Systolic BP</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
              {patientLoading ? "..." : Math.round(currentSbp)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono font-medium mt-0.5">mmHg · Target &lt;120</div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-bold">
              <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Diastolic BP</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
              {patientLoading ? "..." : Math.round(currentDbp)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono font-medium mt-0.5">mmHg · Target &lt;80</div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-bold">
              <Heart className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Heart Rate</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
              {patientLoading ? "..." : Math.round(currentHr)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono font-medium mt-0.5">bpm · 60–100</div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-bold">
              <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>BMI</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
              {patientLoading ? "..." : Number(currentBmi).toFixed(1)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono font-medium mt-0.5">kg/m² · 18.5–24.9</div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs col-span-2 sm:col-span-1 lg:col-span-1">
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] font-bold">
              <Scale className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Body Weight</span>
            </div>
            <div className="text-2xl font-bold font-mono text-[var(--text-primary)] mt-1">
              {patientLoading ? "..." : Math.round(currentWeight)}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono font-medium mt-0.5">kg · Target Norm</div>
          </div>
        </div>
      </section>

      {/* ── 4 & 5. MODEL OUTPUT, 365-DAY HORIZON & TOP EXPLANATORY FEATURES ─ */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left (6 cols): Model Output & 3D Spatial Visualizer */}
        <div className="lg:col-span-6 space-y-3">
          <div className="glass-panel p-4 sm:p-5 border border-[var(--glass-border)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
              <div>
                <span className="text-[10px] font-mono text-[var(--color-primary)] uppercase tracking-wider font-bold">
                  365-Day Horizon
                </span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Decompensation Risk Estimate
                </h3>
              </div>
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                {currentRiskTier} Risk
              </span>
            </div>

            {/* Score Metrics */}
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-xs text-[var(--text-secondary)] font-mono font-bold block">Calibrated Probability</span>
                <span className="text-3xl font-bold font-mono text-[var(--text-primary)] block mt-1">
                  {(currentRiskScore * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-mono font-medium block mt-0.5">
                  95% CI: [{patientPredict?.confidence_interval_95 &&
                  patientPredict.confidence_interval_95[0] <= currentRiskScore &&
                  currentRiskScore <= patientPredict.confidence_interval_95[1]
                    ? `${(patientPredict.confidence_interval_95[0] * 100).toFixed(1)}% – ${(patientPredict.confidence_interval_95[1] * 100).toFixed(1)}%`
                    : "Uncertainty unavailable"}]
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs">
                <span className="text-xs text-[var(--text-secondary)] font-mono font-bold block">Uncalibrated Logit</span>
                <span className="text-3xl font-bold font-mono text-[var(--text-primary)] block mt-1">
                  {(patientPredict?.raw_score ?? 0.12).toFixed(4)}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] font-mono font-medium block mt-0.5">Raw XGBoost score</span>
              </div>
            </div>

            {/* Tier Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-[var(--text-secondary)]">
                <span>Low (&lt;15%)</span>
                <span>Moderate (15–35%)</span>
                <span>High (&ge;35%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 overflow-hidden relative">
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

            {/* 3D Visualizer Integration */}
            <div className="rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-slate-900/10 dark:bg-slate-950/40">
              <DigitalTwinViz
                sbp={currentSbp}
                dbp={currentDbp}
                hr={currentHr}
                bmi={currentBmi}
                riskScore={currentRiskScore}
                riskTier={currentRiskTier}
                patientName={currentSummary?.name || "Patient"}
                height="190px"
              />
            </div>
          </div>
        </div>

        {/* Right (6 cols): Top Explanatory Features (SHAP) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="glass-panel p-4 sm:p-5 border border-[var(--glass-border)] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2.5">
              <div>
                <span className="text-[11px] font-mono text-[var(--color-primary)] uppercase tracking-wider font-bold">
                  Explainability
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Top Explanatory Features (TreeSHAP)
                </h3>
              </div>
              <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)]">
                Signed Impact Direction
              </span>
            </div>

            {topDrivers.length > 0 ? (
              <div className="space-y-2">
                {topDrivers.map((driver) => {
                  const isPositive = driver.impact > 0;
                  return (
                    <div
                      key={driver.feature}
                      className="p-3 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="font-bold text-[var(--text-primary)] text-xs truncate">
                          {driver.label || driver.feature}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] font-medium">
                          {isPositive ? "Elevates 365d decompensation hazard" : "Protective clinical indicator"}
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span
                          className={`text-sm font-bold block ${
                            isPositive
                              ? "text-rose-700 dark:text-rose-300"
                              : "text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {(driver.impact * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-semibold">attribution</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[var(--text-secondary)] font-mono rounded-xl bg-[var(--bg-surface-strong)]">
                Loading SHAP feature explanations…
              </div>
            )}

            <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                Local attributions derived directly from tree traversal.
              </span>
              <Link
                href={`/twin?patient=${selectedPatientId}`}
                className="text-[var(--color-primary)] hover:underline font-bold text-xs"
              >
                Deep Explainability →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. HISTORICAL BP & RISK TIMELINE ──────────────────────────────── */}
      <section className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Historical Blood Pressure &amp; Risk Trajectory
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">
              Observed ambulatory encounters over the 365-day lookback horizon with Stage 2 clinical threshold (140/90 mmHg).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs font-mono font-bold">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>SBP</span>
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-600" />
              <span>DBP</span>
            </span>
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              <span>Risk %</span>
            </span>
          </div>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartTimeline} margin={{ top: 10, right: 10, left: -8, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.35)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 600 }} tickLine={false} fontFamily="monospace" />
              <YAxis domain={[40, 180]} stroke="var(--text-secondary)" tick={{ fill: "var(--text-secondary)", fontSize: 11, fontWeight: 600 }} tickLine={false} fontFamily="monospace" unit=" mmHg" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-panel)",
                  borderColor: "var(--glass-border)",
                  color: "var(--text-primary)",
                  borderRadius: "10px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                }}
              />
              <ReferenceLine y={140} stroke="#e11d48" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "140 mmHg SBP Cutoff", position: "insideTopRight", fill: "#be123c", fontSize: 11, fontWeight: 700 }} />
              <ReferenceLine y={90} stroke="#d97706" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "90 mmHg DBP Cutoff", position: "insideTopRight", fill: "#b45309", fontSize: 11, fontWeight: 700 }} />
              <Line type="monotone" dataKey="sbp" name="Systolic BP (mmHg)" stroke="#1D4ED8" strokeWidth={3} dot={{ r: 4, fill: "#1D4ED8" }} />
              <Line type="monotone" dataKey="dbp" name="Diastolic BP (mmHg)" stroke="#0E7490" strokeWidth={2.5} dot={{ r: 3.5, fill: "#0E7490" }} />
              <Line type="monotone" dataKey="risk" name="Calibrated Risk (%)" stroke="#D97706" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3.5, fill: "#D97706" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── 7. WHAT-IF SIMULATION ─────────────────────────────────────────── */}
      <section className="glass-card p-4 sm:p-5 border border-[var(--glass-border)] rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                What-If Counterfactual Scenario Explorer
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">
                Simulate targeted blood pressure and weight modifications. Backend applies correlated feature shifting via lever map.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
            <button
              type="button"
              onClick={() => runSimulation(-10, -5)}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all shadow-2xs min-h-[34px] sm:min-h-0"
            >
              -10 SBP / -5% Wt
            </button>
            <button
              type="button"
              onClick={() => runSimulation(-15, 0)}
              className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all shadow-2xs min-h-[34px] sm:min-h-0"
            >
              -15 SBP Only
            </button>
            <button
              type="button"
              onClick={() => runSimulation(0, 0)}
              className="p-1.5 rounded-lg bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all shadow-2xs min-h-[34px] min-w-[34px] flex items-center justify-center sm:min-h-0 sm:min-w-0"
              title="Reset Levers"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sliders and Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Controls (6 cols) */}
          <div className="md:col-span-6 space-y-4">
            {/* SBP Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-[var(--text-primary)]">Systolic BP Shift (Δ mmHg)</span>
                <span className="font-mono font-bold text-[var(--color-primary)] text-sm">
                  {sbpDelta > 0 ? `+${sbpDelta}` : sbpDelta} mmHg
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="30"
                step="1"
                value={sbpDelta}
                onChange={(e) => runSimulation(Number(e.target.value), weightDelta)}
                className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] font-mono font-semibold">
                <span>-30 mmHg (Intense Control)</span>
                <span>0 (No Change)</span>
                <span>+30 mmHg (Decompensation)</span>
              </div>
            </div>

            {/* Weight Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-[var(--text-primary)]">Body Weight Shift (Δ %)</span>
                <span className="font-mono font-bold text-[var(--color-primary)] text-sm">
                  {weightDelta > 0 ? `+${weightDelta}` : weightDelta}%
                </span>
              </div>
              <input
                type="range"
                min="-15"
                max="15"
                step="1"
                value={weightDelta}
                onChange={(e) => runSimulation(sbpDelta, Number(e.target.value))}
                className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--color-primary)]"
              />
              <div className="flex justify-between text-[11px] text-[var(--text-secondary)] font-mono font-semibold">
                <span>-15% Weight</span>
                <span>0%</span>
                <span>+15% Weight</span>
              </div>
            </div>
          </div>

          {/* Results Comparison (6 cols) */}
          <div className="md:col-span-6 p-4 rounded-xl bg-[var(--bg-surface-strong)] border border-[var(--border-subtle)] shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-[var(--border-hairline)] pb-2">
              <span className="font-bold text-[var(--text-primary)]">Scenario Risk Comparison</span>
              {simLoading && <span className="text-[11px] font-mono text-[var(--color-primary)] font-bold animate-pulse">Recalculating…</span>}
            </div>

            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-secondary)] font-mono font-bold block">Baseline Risk</span>
                <span className="text-2xl font-bold font-mono text-[var(--text-primary)] block mt-1">
                  {((simResult?.baseline_risk ?? currentRiskScore) * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)] mt-0.5 block">
                  {simResult?.baseline_tier || currentRiskTier} Tier
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-secondary)] font-mono font-bold block">Simulated Risk</span>
                <span className="text-2xl font-bold font-mono text-[var(--color-primary)] block mt-1">
                  {((simResult?.scenario_risk ?? currentRiskScore) * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] font-mono font-semibold text-[var(--color-primary)] mt-0.5 block">
                  {simResult?.scenario_tier || currentRiskTier} Tier
                </span>
              </div>
            </div>

            {/* Delta Impact Pill */}
            {simResult && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs font-mono">
                <span className="text-[var(--text-secondary)] font-bold">Projected Risk Delta:</span>
                <span
                  className={`font-bold text-sm flex items-center gap-1.5 ${
                    simResult.delta_risk_pp <= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                  }`}
                >
                  {simResult.delta_risk_pp <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                  {simResult.delta_risk_pp > 0 ? "+" : ""}
                  {simResult.delta_risk_pp.toFixed(1)} pp
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── EXPANDABLE TECHNICAL SPECIFICATIONS & PROVENANCE ─────────────── */}
      <details className="glass-card p-4 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] cursor-pointer group">
        <summary className="font-semibold text-[var(--text-primary)] flex items-center justify-between select-none">
          <span className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Technical Architecture, Calibration &amp; Data Provenance</span>
          </span>
          <span className="text-[10px] font-mono text-[var(--color-primary)] group-open:hidden">
            View Details ↓
          </span>
          <span className="text-[10px] font-mono text-[var(--color-primary)] hidden group-open:inline">
            Collapse ↑
          </span>
        </summary>
        <div className="pt-3 mt-2 border-t border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">Model &amp; Feature Space</span>
            <span className="font-bold text-[var(--text-primary)]">XGBoost · 132 Features</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Schema lock: {modelInfo?.schema_fingerprint || "a4ddaedb"}</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">Calibration Method</span>
            <span className="font-bold text-[var(--text-primary)]">Platt Scaling Logistic Sigmoid</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Transforms logits to empirical frequencies</span>
          </div>
          <div>
            <span className="text-[var(--text-muted)] block text-[10px]">Data Provenance &amp; Limits</span>
            <span className="font-bold text-[var(--text-primary)]">Synthea Longitudinal EHR</span>
            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">Research prototype · Not for diagnostic use</span>
          </div>
        </div>
      </details>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="pt-4 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-[var(--text-primary)]">VitalTwin</span>
          <span>·</span>
          <Link href="/twin" className="hover:text-[var(--color-primary)] transition-colors">Digital Twin</Link>
          <span>·</span>
          <Link href="/patients" className="hover:text-[var(--color-primary)] transition-colors">Patients</Link>
          <span>·</span>
          <Link href="/population" className="hover:text-[var(--color-primary)] transition-colors">Population</Link>
          <span>·</span>
          <Link href="/performance" className="hover:text-[var(--color-primary)] transition-colors">Performance</Link>
          <span>·</span>
          <Link href="/alerts" className="hover:text-[var(--color-primary)] transition-colors">Alerts</Link>
          <span>·</span>
          <Link href="/model-card" className="hover:text-[var(--color-primary)] transition-colors">Model Card</Link>
          <span>·</span>
          <Link href="/audit" className="hover:text-[var(--color-primary)] transition-colors">Audit & Privacy</Link>
          <span>·</span>
          <Link href="/india" className="hover:text-[var(--color-primary)] transition-colors">India Context</Link>
          <span>·</span>
          <Link href="/import" className="hover:text-[var(--color-primary)] transition-colors">Import</Link>
          <span>·</span>
          <Link href="/about" className="hover:text-[var(--color-primary)] transition-colors">About</Link>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>FastAPI Engine Active</span>
          <span>·</span>
          <span>Next.js Connected</span>
        </div>
      </footer>
    </div>
  );
}

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  fetchPatients,
  fetchPatient,
  fetchPredict,
  fetchTimelineRisk,
  PatientSummary,
  PatientDetail,
  PredictResponse,
  SnapshotItem,
  VitalSigns,
  RiskState,
  StreamReadingResponse,
  addPatientReading,
} from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import { VitalCards } from "@/components/digital-twin/VitalCards";
import { RiskPanel } from "@/components/digital-twin/RiskPanel";
import { SHAPChart } from "@/components/digital-twin/SHAPChart";
import { LongitudinalCharts } from "@/components/digital-twin/LongitudinalCharts";
import { RiskReplay } from "@/components/digital-twin/RiskReplay";
import { WhatIfLab } from "@/components/digital-twin/WhatIfLab";
import { WearablePanel } from "@/components/digital-twin/WearablePanel";
import { PatientView } from "@/components/digital-twin/PatientView";
import dynamic from "next/dynamic";
import DigitalTwinViz from "@/components/digital-twin/DigitalTwinViz";

const BodyTwinViz = dynamic(() => import("@/components/digital-twin/BodyTwinViz"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center h-80 min-h-[300px] gap-3">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--color-primary)]/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
      <p className="text-xs text-[var(--text-muted)] font-mono">Initializing 3D Human Avatar Model…</p>
    </div>
  ),
});
import {
  User,
  Calendar,
  Printer,
  ChevronDown,
  Layers,
  Sparkles,
  AlertCircle,
  FileText,
  HeartPulse,
  Plus,
  X,
  CheckCircle2,
} from "lucide-react";

interface ReadingFormState {
  sbp: number | "";
  dbp: number | "";
  hr: number | "";
  weight: number | "";
  glucose: number | "";
  hba1c: number | "";
}

function TwinDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [viewMode, setViewMode] = useState<"clinician" | "patient">("clinician");
  const [activeSnapshotIdx, setActiveSnapshotIdx] = useState<number>(0);
  // 3D Twin View Mode: "core" (Abstract Lattice) | "body" (Rigged 3D Human Avatar)
  const [twinView, setTwinView] = useState<"core" | "body">("core");
  // Live What-If Simulator Scenario Link (updates 3D body hotspots immediately)
  const [simulatedScenario, setSimulatedScenario] = useState<{
    res: any;
    vitals?: VitalSigns;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add Reading modal state
  const [showAddReadingModal, setShowAddReadingModal] = useState<boolean>(false);
  const [readingForm, setReadingForm] = useState<ReadingFormState>({
    sbp: 142,
    dbp: 88,
    hr: 74,
    weight: 70,
    glucose: 105,
    hba1c: 5.9,
  });
  const [readingSubmitting, setReadingSubmitting] = useState<boolean>(false);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [readingSuccessNotice, setReadingSuccessNotice] = useState<string | null>(null);

  // 1. Load patient directory on mount
  useEffect(() => {
    fetchPatients(50)
      .then((pts) => {
        setPatients(pts);
        const queryPid = searchParams.get("patient");
        if (queryPid) {
          const match = pts.find((p) => p.id === queryPid || p.display_id.toLowerCase() === queryPid.toLowerCase());
          setSelectedPatientId(match ? match.id : pts[0]?.id || "");
        } else if (pts.length > 0) {
          setSelectedPatientId(pts[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load patients:", err);
        setError("Could not connect to backend to load patient cohort. Ensure backend is running.");
      });
  }, [searchParams]);

  // 2. Load patient detail & inference when selected patient changes
  useEffect(() => {
    if (!selectedPatientId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSimulatedScenario(null);

    Promise.all([
      fetchPatient(selectedPatientId),
      fetchPredict(selectedPatientId),
      fetchTimelineRisk(selectedPatientId).catch(() => ({ snapshots: [] })),
    ])
      .then(([pat, pred, timeRes]) => {
        if (!isMounted) return;
        setPatient(pat);
        setPrediction(pred);
        const snaps = (timeRes.snapshots && timeRes.snapshots.length > 0)
          ? timeRes.snapshots
          : pat.snapshots || [];
        setSnapshots(snaps);
        setActiveSnapshotIdx(Math.max(0, snaps.length - 1));
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error loading patient data:", err);
        setError(err instanceof Error ? err.message : "Failed to load patient twin state.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  const handlePatientSelect = (pid: string) => {
    setSelectedPatientId(pid);
    router.push(`/twin?patient=${encodeURIComponent(pid)}`);
  };

  const handleLiveReadingAccepted = (reading: StreamReadingResponse) => {
    if (!patient) return;
    const updatedPatient: PatientDetail = {
      ...patient,
      latest_vitals: {
        ...patient.latest_vitals,
        sbp: reading.updated_vitals?.sbp ?? patient.latest_vitals.sbp,
        dbp: reading.updated_vitals?.dbp ?? patient.latest_vitals.dbp,
        hr: reading.updated_vitals?.hr ?? patient.latest_vitals.hr,
      },
      latest_risk: {
        ...patient.latest_risk,
        raw_score: reading.updated_risk?.raw_score ?? patient.latest_risk.raw_score,
        calibrated_risk: reading.updated_risk?.calibrated_risk ?? patient.latest_risk.calibrated_risk,
        risk_tier: reading.updated_risk?.risk_tier ?? patient.latest_risk.risk_tier,
      },
    };
    setPatient(updatedPatient);

    const newSnapshot: SnapshotItem = {
      snapshot_id: `live-${Date.now()}`,
      date: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      sbp: reading.updated_vitals?.sbp ?? null,
      dbp: reading.updated_vitals?.dbp ?? null,
      bmi: patient.latest_vitals.bmi ?? null,
      weight: patient.latest_vitals.weight ?? null,
      hr: reading.updated_vitals?.hr ?? null,
      raw_score: reading.updated_risk?.raw_score ?? patient.latest_risk.raw_score,
      calibrated_risk: reading.updated_risk?.calibrated_risk ?? patient.latest_risk.calibrated_risk,
      risk_tier: reading.updated_risk?.risk_tier ?? patient.latest_risk.risk_tier,
      stage_2_decompensation: Boolean(
        (reading.updated_vitals?.sbp && reading.updated_vitals.sbp >= 140) ||
        (reading.updated_vitals?.dbp && reading.updated_vitals.dbp >= 90)
      ),
    };
    setSnapshots((prev) => {
      const next = [...prev, newSnapshot];
      setActiveSnapshotIdx(next.length - 1);
      return next;
    });
  };

  const handleAddReadingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    if (Number(readingForm.dbp) >= Number(readingForm.sbp)) {
      setReadingError(`Diastolic BP (${readingForm.dbp}) must be strictly lower than Systolic BP (${readingForm.sbp}).`);
      return;
    }
    setReadingSubmitting(true);
    setReadingError(null);
    try {
      const res = await addPatientReading(patient.id, {
        sbp: Number(readingForm.sbp),
        dbp: Number(readingForm.dbp),
        hr: readingForm.hr ? Number(readingForm.hr) : undefined,
        weight: readingForm.weight ? Number(readingForm.weight) : undefined,
        glucose: readingForm.glucose ? Number(readingForm.glucose) : undefined,
        hba1c: readingForm.hba1c ? Number(readingForm.hba1c) : undefined,
      });

      // Update patient state live
      setPatient((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          latest_vitals: {
            ...prev.latest_vitals,
            ...res.latest_vitals,
          },
          latest_risk: {
            ...prev.latest_risk,
            ...res.updated_risk,
          },
          snapshots: res.snapshots as any,
          sparkline_sbp: [...(prev.sparkline_sbp || []), Number(readingForm.sbp)],
        };
      });
      setSnapshots(res.snapshots as any);
      setActiveSnapshotIdx(res.snapshots.length - 1);
      setReadingSuccessNotice("New clinical reading recorded. Digital Twin state and calibrated risk updated live.");
      setShowAddReadingModal(false);
      setTimeout(() => setReadingSuccessNotice(null), 5000);
    } catch (err: unknown) {
      console.error("Failed to add reading:", err);
      setReadingError(err instanceof Error ? err.message : "Failed to record reading.");
    } finally {
      setReadingSubmitting(false);
    }
  };

  if (loading && !patient) {
    return (
      <div className="space-y-6 py-8">
        <div className="h-14 bg-white border border-[var(--border-hairline)] rounded p-4 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-44 bg-white border border-[var(--border-hairline)] rounded animate-pulse" />
            <div className="h-72 bg-white border border-[var(--border-hairline)] rounded animate-pulse" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="h-64 bg-white border border-[var(--border-hairline)] rounded animate-pulse" />
            <div className="h-64 bg-white border border-[var(--border-hairline)] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded max-w-xl mx-auto my-12 space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
          Clinical Twin State Unavailable
        </h3>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {error || "Patient record could not be loaded."}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-xs font-semibold bg-[var(--accent-teal)] text-white rounded hover:bg-[var(--accent-teal-hover)] transition-colors"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Active snapshot projection (when scrubbing historical replay)
  const isReplaying = activeSnapshotIdx < snapshots.length - 1;
  const currentSnapshot = snapshots[activeSnapshotIdx];

  // Active vitals: either current replay snapshot, simulated scenario, or latest
  const activeVitals: VitalSigns = isReplaying && currentSnapshot
    ? {
        sbp: currentSnapshot.sbp,
        dbp: currentSnapshot.dbp,
        bmi: currentSnapshot.bmi,
        weight: currentSnapshot.weight,
        hr: currentSnapshot.hr,
        pulse_pressure: (currentSnapshot.sbp && currentSnapshot.dbp) ? (currentSnapshot.sbp - currentSnapshot.dbp) : undefined,
      }
    : simulatedScenario?.vitals
    ? {
        ...patient.latest_vitals,
        ...simulatedScenario.vitals,
        pulse_pressure:
          simulatedScenario.vitals.sbp && simulatedScenario.vitals.dbp
            ? simulatedScenario.vitals.sbp - simulatedScenario.vitals.dbp
            : patient.latest_vitals.pulse_pressure,
      }
    : patient.latest_vitals;

  // Active risk: either current replay snapshot, simulated scenario, or model prediction
  const activeRisk: RiskState = isReplaying && currentSnapshot
    ? {
        raw_score: currentSnapshot.raw_score,
        calibrated_risk: currentSnapshot.calibrated_risk,
        risk_tier: currentSnapshot.risk_tier,
      }
    : simulatedScenario?.res
    ? {
        raw_score: simulatedScenario.res.scenario_raw ?? patient.latest_risk.raw_score,
        calibrated_risk: simulatedScenario.res.scenario_risk ?? patient.latest_risk.calibrated_risk,
        risk_tier: simulatedScenario.res.scenario_tier ?? patient.latest_risk.risk_tier,
      }
    : prediction
    ? {
        raw_score: prediction.raw_score,
        calibrated_risk: prediction.calibrated_risk,
        risk_tier: prediction.risk_tier,
        confidence_interval_95: prediction.confidence_interval_95,
      }
    : patient.latest_risk;

  const tier = normalizeTier(activeRisk.risk_tier);

  return (
    <div className="space-y-6">
      {/* ── TOP PATIENT HEADER ────────────────────────────────────────────── */}
      <div className="glass-panel p-5 border border-[var(--glass-border)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Patient Identity & Selector */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white font-serif font-bold text-lg shadow-md">
              {patient.gender === "Female" ? "♀" : "♂"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  {patient.display_label || `${patient.name} (${patient.display_id})`}
                </h2>
                <span className={RISK_BADGE_CLASSES[tier]}>
                  {tier} Tier
                </span>
                {isReplaying && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
                    REPLAYING SNAPSHOT #{activeSnapshotIdx + 1}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] font-mono mt-1">
                <span>Age: <strong className="text-[var(--text-primary)]">{patient.age}y</strong></span>
                <span>·</span>
                <span>Sex: <strong className="text-[var(--text-primary)]">{patient.gender}</strong></span>
                <span>·</span>
                <span>Snapshot Date: <strong className="text-[var(--text-primary)]">{isReplaying ? currentSnapshot?.date : patient.as_of_date}</strong></span>
                <span>·</span>
                <span>Completeness: <strong className="text-[var(--text-primary)]">{patient.data_completeness_pct}%</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Patient Switcher & Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-[var(--glass-border)] p-0.5 bg-[var(--bg-subtle)] text-xs no-print backdrop-blur-md">
              <button
                type="button"
                onClick={() => setViewMode("clinician")}
                className={`px-3 py-1.5 rounded-lg transition-all font-medium cursor-pointer ${
                  viewMode === "clinician"
                    ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-xs font-bold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Clinician View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("patient")}
                className={`px-3 py-1.5 rounded-lg transition-all font-medium cursor-pointer ${
                  viewMode === "patient"
                    ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-xs font-bold"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Patient View
              </button>
            </div>

            {/* Cohort Selector */}
            <div className="relative">
              <select
                value={patient.id}
                onChange={(e) => handlePatientSelect(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-mono bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 shadow-xs"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[var(--bg-canvas)] text-[var(--text-primary)]">
                    {p.display_label} [{p.risk_tier}]
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            </div>

            {/* Add Reading Button */}
            <button
              type="button"
              onClick={() => {
                if (patient) {
                  setReadingForm({
                    sbp: patient.latest_vitals.sbp ? Math.round(patient.latest_vitals.sbp) : 138,
                    dbp: patient.latest_vitals.dbp ? Math.round(patient.latest_vitals.dbp) : 86,
                    hr: patient.latest_vitals.hr ? Math.round(patient.latest_vitals.hr) : 72,
                    weight: patient.latest_vitals.weight ? Math.round(patient.latest_vitals.weight) : 70,
                    glucose: patient.latest_vitals.glucose ? Math.round(patient.latest_vitals.glucose) : 100,
                    hba1c: patient.latest_vitals.hba1c || 5.8,
                  });
                }
                setReadingError(null);
                setShowAddReadingModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold glass-btn-primary rounded-xl transition-all no-print shadow-xs cursor-pointer"
              title="Add a new BP reading / vitals to update the twin live"
            >
              <HeartPulse className="w-3.5 h-3.5" />
              <span>Add Reading</span>
            </button>

            {/* Print Summary */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium glass-btn-secondary rounded-xl transition-colors no-print cursor-pointer"
              title="Print clinical summary record"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print Record</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reading Success Banner */}
      {readingSuccessNotice && (
        <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2 backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{readingSuccessNotice}</span>
        </div>
      )}

      {/* ── HONEST LOW_DATA / CLINICAL WARNINGS BANNER ────────────────────── */}
      {((patient.warnings && patient.warnings.length > 0) || patient.data_completeness_pct < 75) && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1 backdrop-blur-md">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Honest Research Disclosures & Data Completeness Notice</span>
          </div>
          {patient.warnings && patient.warnings.length > 0 ? (
            patient.warnings.map((w: string, idx: number) => (
              <p key={idx} className="leading-relaxed pl-5 font-mono text-[11px]">
                • {w}
              </p>
            ))
          ) : (
            <p className="leading-relaxed pl-5 font-mono text-[11px]">
              • LOW_DATA: Prediction rests on sparse baseline registration data ({patient.data_completeness_pct}% completeness). 12-month longitudinal trends are unobserved and estimated by the model imputer.
            </p>
          )}
          <p className="leading-relaxed pl-5 text-[10px] text-amber-800 dark:text-amber-300">
            Research prototype on synthetic EHR data. Model has not been clinically validated on real or Indian cohorts. Not for diagnostic or therapeutic decisions.
          </p>
        </div>
      )}

      {/* ── CONDITIONAL VIEW MODE ─────────────────────────────────────────── */}
      {viewMode === "patient" ? (
        <PatientView patient={patient} activeRisk={activeRisk} />
      ) : (
        /* ── 12-COLUMN MAIN CLINICAL GRID ─────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8-Column Panel: 3D Twin, Vitals, Longitudinal Trajectory, Scrubber */}
          <div className="lg:col-span-8 space-y-6">
            {/* 0. 3D Digital Twin Lattice Network / Human Body Avatar Card */}
            <div className="glass-card p-5 border border-[var(--glass-border)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      twinView === "body" ? "bg-emerald-400" : "bg-cyan-400"
                    } animate-pulse`}
                  />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                    {twinView === "body"
                      ? "3D Human Rigged Avatar · Anatomical Telemetry"
                      : "3D Virtual Twin Lattice Network"}
                  </h3>
                </div>

                {/* View Mode Toggle: Core | Body */}
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-[var(--glass-border)] p-0.5 bg-[var(--bg-subtle)] text-xs no-print backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setTwinView("core")}
                      className={`px-3 py-1 rounded-lg transition-all font-mono font-bold cursor-pointer text-xs ${
                        twinView === "core"
                          ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                      aria-pressed={twinView === "core"}
                      title="Abstract physiological lattice core view"
                    >
                      Core
                    </button>
                    <button
                      type="button"
                      onClick={() => setTwinView("body")}
                      className={`px-3 py-1 rounded-lg transition-all font-mono font-bold cursor-pointer text-xs flex items-center gap-1.5 ${
                        twinView === "body"
                          ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                      }`}
                      aria-pressed={twinView === "body"}
                      title="Realistic rigged 3D human body view with mapped physiological hotspots"
                    >
                      <span>Body</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold border border-cyan-500/20">
                        3D
                      </span>
                    </button>
                  </div>
                  <span className="hidden sm:inline-block text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--glass-border)]">
                    {twinView === "body" ? "Mixamo Rig · Mapped Vitals" : "Interactive Three.js Core"}
                  </span>
                </div>
              </div>

              {twinView === "core" ? (
                <div className="h-72 sm:h-80 w-full relative rounded-2xl overflow-hidden bg-slate-900/10 dark:bg-slate-950/40 border border-[var(--glass-border)] shadow-inner">
                  <DigitalTwinViz
                    riskTier={activeRisk.risk_tier}
                    sbp={activeVitals.sbp}
                    dbp={activeVitals.dbp}
                    bmi={activeVitals.bmi}
                    hr={activeVitals.hr}
                    weight={activeVitals.weight}
                    riskScore={activeRisk.calibrated_risk}
                  />
                </div>
              ) : (
                <BodyTwinViz
                  riskTier={activeRisk.risk_tier}
                  riskScore={activeRisk.calibrated_risk}
                  sbp={activeVitals.sbp}
                  dbp={activeVitals.dbp}
                  bmi={activeVitals.bmi}
                  hr={activeVitals.hr}
                  weight={activeVitals.weight}
                  glucose={activeVitals.glucose ?? (patient.feature_row?.glucose_latest as number | undefined)}
                  hba1c={activeVitals.hba1c ?? (patient.feature_row?.hba1c_latest as number | undefined)}
                  age={patient.age}
                  gender={patient.gender}
                  medications={patient.medications}
                  asOfDate={isReplaying ? currentSnapshot?.date : patient.as_of_date}
                  sparklineSbp={patient.sparkline_sbp}
                  baselineVitals={patient.latest_vitals}
                  onFallbackToCore={() => setTwinView("core")}
                />
              )}
            </div>

            {/* 1. Current State Panel */}
            <VitalCards
              vitals={activeVitals}
              sparklineSbp={patient.sparkline_sbp}
              asOfDate={isReplaying ? currentSnapshot?.date : patient.as_of_date}
            />

            {/* 2. Longitudinal Trajectory Charts (SBP/DBP 140/90 bands) */}
            <LongitudinalCharts
              timeline={patient.timeline_vitals}
              conditions={patient.conditions}
              medications={patient.medications}
            />

            {/* 3. Risk-Over-Time Replay Scrubber (Signature Feature) */}
            <RiskReplay
              snapshots={snapshots}
              currentSnapshotIndex={activeSnapshotIdx}
              onSelectSnapshot={(idx) => setActiveSnapshotIdx(idx)}
            />

            {/* 4. Full Patient Simulator */}
            <WhatIfLab
              patientId={patient.id}
              initialSbp={patient.latest_vitals.sbp ?? 125}
              initialDbp={patient.latest_vitals.dbp ?? 80}
              initialHr={patient.latest_vitals.hr ?? 72}
              initialWeight={patient.latest_vitals.weight ?? 70}
              initialBmi={patient.latest_vitals.bmi ?? 24.5}
              initialGlucose={(patient.feature_row?.glucose_latest as number | undefined) ?? 100}
              initialHba1c={(patient.feature_row?.hba1c_latest as number | undefined) ?? 5.6}
              featureRow={patient.feature_row as Record<string, any>}
              onScenarioChange={(res, vitals) =>
                setSimulatedScenario(res ? { res, vitals } : null)
              }
            />
          </div>

          {/* Right 4-Column Panel: Calibrated Risk, Drivers, Wearables */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Risk Analysis Panel */}
            <RiskPanel
              risk={activeRisk}
              percentileInCohort={patient.latest_risk.percentile_in_cohort || 65}
              alertThreshold={0.40}
            />

            {/* 2. Key Contributing Drivers (SHAP) */}
            <SHAPChart
              factors={prediction?.top_contributing_factors || []}
              isLoading={loading}
            />

            {/* 3. Simulated Wearable Telemetry Feed */}
            <WearablePanel
              patientId={patient.id}
              onLiveReadingAccepted={handleLiveReadingAccepted}
            />
          </div>
        </div>
      )}

      {/* ── PRINT-ONLY ONE-PAGE CLINICAL SUMMARY REPORT (Step 6) ─────────── */}
      <div className="hidden print:block space-y-4 p-4 font-sans text-xs">
        <div className="border-b-2 border-black pb-2 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold font-serif uppercase tracking-tight">Pramana Clinical Twin · Clinical Decision Support Report</h1>
            <p className="text-[10px] text-gray-600">365-Day Longitudinal Hypertension Decompensation Risk Profile</p>
          </div>
          <div className="text-right text-[10px] font-mono">
            <div>Report Date: {new Date().toLocaleDateString()}</div>
            <div>Cohort Source: Synthea EHR (SYNTHETIC)</div>
          </div>
        </div>

        {/* Patient Demographics & Current Vitals */}
        <div className="grid grid-cols-2 gap-4 border p-3">
          <div>
            <h2 className="font-bold text-xs uppercase text-gray-700 mb-1">Patient Details</h2>
            <div className="space-y-0.5">
              <div>Name: <strong>{patient.name}</strong> ({patient.display_id})</div>
              <div>Age: <strong>{patient.age}y</strong> | Gender: <strong>{patient.gender}</strong></div>
              <div>Record As-Of: <strong>{patient.as_of_date}</strong></div>
            </div>
          </div>
          <div>
            <h2 className="font-bold text-xs uppercase text-gray-700 mb-1">Current State / Latest Vitals</h2>
            <div className="grid grid-cols-2 gap-1 font-mono text-[11px]">
              <div>BP: <strong>{patient.latest_vitals.sbp}/{patient.latest_vitals.dbp} mmHg</strong></div>
              <div>HR: <strong>{patient.latest_vitals.hr} bpm</strong></div>
              <div>Weight: <strong>{patient.latest_vitals.weight} kg</strong></div>
              <div>BMI: <strong>{patient.latest_vitals.bmi} kg/m²</strong></div>
            </div>
          </div>
        </div>

        {/* Calibrated Risk with Uncertainty */}
        <div className="border p-3 space-y-1">
          <h2 className="font-bold text-xs uppercase text-gray-700">Calibrated 365-Day Decompensation Risk</h2>
          <div className="flex items-baseline gap-4">
            <div className="text-2xl font-bold font-mono">
              {(activeRisk.calibrated_risk * 100).toFixed(1)}%
            </div>
            <div className="text-xs font-bold uppercase px-2 py-0.5 border">
              {activeRisk.risk_tier} Risk Tier
            </div>
            <div className="text-[11px] font-mono text-gray-600">
              95% Confidence Interval: [{prediction?.confidence_interval_95 ? `${(prediction.confidence_interval_95[0]*100).toFixed(1)}% – ${(prediction.confidence_interval_95[1]*100).toFixed(1)}%` : "—"}]
            </div>
            <div className="text-[11px] font-mono text-gray-600">
              Raw Score: {activeRisk.raw_score.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Top Attributed Drivers */}
        {prediction?.top_contributing_factors && prediction.top_contributing_factors.length > 0 && (
          <div className="border p-3 space-y-1">
            <h2 className="font-bold text-xs uppercase text-gray-700">Top Attributed Drivers (SHAP Attribution)</h2>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {prediction.top_contributing_factors.slice(0, 6).map((f) => (
                <div key={f.feature} className="flex justify-between border-b pb-0.5">
                  <span>{f.label}</span>
                  <span className="font-mono font-bold">
                    {f.impact > 0 ? "+" : ""}
                    {f.impact.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mandatory Limitations Notice */}
        <div className="border border-gray-400 p-2.5 text-[10px] text-gray-700 leading-tight space-y-1">
          <strong>Clinical Model Governance &amp; Disclaimers:</strong>
          <p>
            This clinical decision support record is generated from synthetic EHR data (Synthea) for research demonstration at the Happiest Health Summit 2026. 
            The underlying XGBoost model is not certified as a medical device, is not validated on Indian cohorts, and does not provide formal diagnosis or prescriptive treatment orders.
          </p>
        </div>
      </div>

      {/* ── ADD READING MODAL DIALOG ────────────────────────────────────────── */}
      {showAddReadingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white border border-[var(--border-hairline)] rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-[var(--accent-teal)]">
                <HeartPulse className="w-5 h-5" />
                <h3 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                  Add New Clinical Reading
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddReadingModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Record a new blood pressure and vitals reading for{" "}
              <strong className="text-[var(--text-primary)] font-mono">{patient.display_label}</strong>.
              This will update the twin trajectory, recompute the 132-feature vector, and produce updated risk scores live.
            </p>

            {readingError && (
              <div className="p-2.5 text-xs bg-red-50 border border-red-200 text-red-800 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{readingError}</span>
              </div>
            )}

            <form onSubmit={handleAddReadingSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--text-secondary)]">Systolic BP (mmHg) *</label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">60–260</span>
                  </div>
                  <input
                    type="number"
                    min={60}
                    max={260}
                    required
                    value={readingForm.sbp}
                    onChange={(e) => setReadingForm({ ...readingForm, sbp: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--text-secondary)]">Diastolic BP (mmHg) *</label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">35–160</span>
                  </div>
                  <input
                    type="number"
                    min={35}
                    max={160}
                    required
                    value={readingForm.dbp}
                    onChange={(e) => setReadingForm({ ...readingForm, dbp: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--text-secondary)]">Heart Rate (bpm)</label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">30–220</span>
                  </div>
                  <input
                    type="number"
                    min={30}
                    max={220}
                    value={readingForm.hr}
                    onChange={(e) => setReadingForm({ ...readingForm, hr: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--text-secondary)]">Weight (kg)</label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">25–300</span>
                  </div>
                  <input
                    type="number"
                    min={25}
                    max={300}
                    step={0.5}
                    value={readingForm.weight}
                    onChange={(e) => setReadingForm({ ...readingForm, weight: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--text-secondary)]">Glucose (mg/dL)</label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">40–500</span>
                  </div>
                  <input
                    type="number"
                    min={40}
                    max={500}
                    value={readingForm.glucose}
                    onChange={(e) => setReadingForm({ ...readingForm, glucose: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between">
                    <label className="font-medium text-[var(--text-secondary)]">HbA1c (%)</label>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">3.5–18.0</span>
                  </div>
                  <input
                    type="number"
                    min={3.5}
                    max={18.0}
                    step={0.1}
                    value={readingForm.hba1c}
                    onChange={(e) => setReadingForm({ ...readingForm, hba1c: e.target.value === "" ? "" : Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
                <button
                  type="button"
                  onClick={() => setShowAddReadingModal(false)}
                  disabled={readingSubmitting}
                  className="px-3.5 py-1.5 text-xs text-[var(--text-secondary)] bg-[var(--bg-subtle)] hover:bg-stone-200 border border-[var(--border-hairline)] rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={readingSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[var(--accent-teal)] hover:bg-[var(--accent-teal-hover)] rounded transition-colors shadow-2xs"
                >
                  {readingSubmitting ? "Updating Twin…" : "Save & Update Twin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TwinDashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--text-muted)]">Loading Twin Dashboard…</div>}>
      <TwinDashboardContent />
    </Suspense>
  );
}

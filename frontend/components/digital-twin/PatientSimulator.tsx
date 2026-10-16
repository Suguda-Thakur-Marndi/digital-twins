"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchSimulate,
  fetchSensitivity,
  SimulateRequest,
  SimulateResponse,
  SensitivityResponse,
  SHAPDiffItem,
} from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  Sliders,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Activity,
  Heart,
  Scale,
  Droplet,
  Pill,
  ShieldAlert,
  Search,
  Save,
  Trash2,
  Printer,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
} from "lucide-react";

import featureCatalog from "@/lib/feature_catalog.json";

interface PatientSimulatorProps {
  patientId: string;
  initialVitals?: {
    sbp?: number | null;
    dbp?: number | null;
    hr?: number | null;
    weight?: number | null;
    bmi?: number | null;
    glucose?: number | null;
    hba1c?: number | null;
  };
  featureRow?: Record<string, any>;
  onScenarioChange?: (res: SimulateResponse | null, scenarioVitals?: any) => void;
}

interface SavedScenario {
  id: string;
  name: string;
  timestamp: string;
  response: SimulateResponse;
  leversSummary: string;
}

export function PatientSimulator({
  patientId,
  initialVitals = {},
  featureRow,
  onScenarioChange,
}: PatientSimulatorProps) {
  // Baseline initial values with robust clinical fallbacks
  const baseSbp = initialVitals.sbp ?? (featureRow?.sbp_latest as number | undefined) ?? 125;
  const baseDbp = initialVitals.dbp ?? (featureRow?.dbp_latest as number | undefined) ?? 80;
  const baseHr = initialVitals.hr ?? (featureRow?.hr_latest as number | undefined) ?? 72;
  const baseWeight = initialVitals.weight ?? (featureRow?.weight_latest as number | undefined) ?? 70;
  const baseBmi = initialVitals.bmi ?? (featureRow?.bmi_latest as number | undefined) ?? (baseWeight / (1.7 * 1.7));
  const baseGlucose = initialVitals.glucose ?? (featureRow?.glucose_latest as number | undefined) ?? 100;
  const baseHba1c = initialVitals.hba1c ?? (featureRow?.hba1c_latest as number | undefined) ?? 5.6;

  // Primary Clinical Levers State
  const [sbpVal, setSbpVal] = useState<number>(baseSbp);
  const [dbpVal, setDbpVal] = useState<number>(baseDbp);
  const [hrVal, setHrVal] = useState<number>(baseHr);
  const [weightVal, setWeightVal] = useState<number>(baseWeight);
  const [glucoseVal, setGlucoseVal] = useState<number>(baseGlucose);
  const [hba1cVal, setHba1cVal] = useState<number>(baseHba1c);
  const [trend, setTrend] = useState<"improving" | "stable" | "worsening">("stable");

  // Condition & Medication Toggles
  const [conditions, setConditions] = useState<Record<string, number>>({
    htn_history: 1,
    diabetes_history: 0,
    obesity_history: 0,
    cvd_history: 0,
    ckd_history: 0,
  });

  const [medications, setMedications] = useState<Record<string, number>>({
    antihypertensive_med_history: 1,
    antidiabetic_med_history: 0,
    statin_lipid_med_history: 0,
  });

  // Advanced Table Tweaks
  const [advancedSearch, setAdvancedSearch] = useState<string>("");
  const [customFeatures, setCustomFeatures] = useState<Record<string, number>>({});
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Simulation & Sensitivity Data
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [activeCurveVar, setActiveCurveVar] = useState<string>("sbp");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Saved Scenarios for Side-by-Side Comparison
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [activeTab, setActiveTab] = useState<"live" | "compare">("live");

  // Sync state if patient changes
  useEffect(() => {
    setSbpVal(baseSbp);
    setDbpVal(baseDbp);
    setHrVal(baseHr);
    setWeightVal(baseWeight);
    setGlucoseVal(baseGlucose);
    setHba1cVal(baseHba1c);
    setTrend("stable");
    setCustomFeatures({});
  }, [patientId, baseSbp, baseDbp, baseHr, baseWeight, baseGlucose, baseHba1c]);

  // Load Sensitivity Curves on patient mount
  useEffect(() => {
    if (!patientId) return;
    fetchSensitivity(patientId)
      .then((data) => setSensitivity(data))
      .catch((err) => console.warn("Sensitivity data unavailable:", err));
  }, [patientId]);

  // Derived current BMI based on weight ratio
  const currentBmi = useMemo(() => {
    if (baseWeight <= 0) return baseBmi;
    return Number((baseBmi * (weightVal / baseWeight)).toFixed(1));
  }, [weightVal, baseWeight, baseBmi]);

  // Execute Debounced Simulation
  const runSimulation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: SimulateRequest = {
        patient_id: patientId,
        sbp_value: sbpVal,
        dbp_value: dbpVal,
        hr_value: hrVal,
        weight_value: weightVal,
        glucose_value: glucoseVal,
        hba1c_value: hba1cVal,
        trend,
        conditions,
        medications,
        custom_features: Object.keys(customFeatures).length > 0 ? customFeatures : undefined,
      };
      const res = await fetchSimulate(payload);
      setSimulation(res);
      if (onScenarioChange) {
        onScenarioChange(res, {
          sbp: sbpVal,
          dbp: dbpVal,
          hr: hrVal,
          weight: weightVal,
          bmi: currentBmi,
          glucose: glucoseVal,
          hba1c: hba1cVal,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Simulation request failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [
    patientId,
    sbpVal,
    dbpVal,
    hrVal,
    weightVal,
    glucoseVal,
    hba1cVal,
    trend,
    conditions,
    medications,
    customFeatures,
    onScenarioChange,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 300);
    return () => clearTimeout(timer);
  }, [runSimulation]);

  // Reset Actions
  const handleResetAll = () => {
    setSbpVal(baseSbp);
    setDbpVal(baseDbp);
    setHrVal(baseHr);
    setWeightVal(baseWeight);
    setGlucoseVal(baseGlucose);
    setHba1cVal(baseHba1c);
    setTrend("stable");
    setConditions({
      htn_history: 1,
      diabetes_history: 0,
      obesity_history: 0,
      cvd_history: 0,
      ckd_history: 0,
    });
    setMedications({
      antihypertensive_med_history: 1,
      antidiabetic_med_history: 0,
      statin_lipid_med_history: 0,
    });
    setCustomFeatures({});
    if (onScenarioChange) onScenarioChange(null, undefined);
  };

  // Presets Handlers
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case "improve_bp":
        setSbpVal(Math.max(105, baseSbp - 15));
        setDbpVal(Math.max(70, baseDbp - 8));
        setTrend("improving");
        break;
      case "weight_loss":
        setWeightVal(Math.max(45, Math.round(baseWeight * 0.93 * 10) / 10));
        break;
      case "worsening_diabetes":
        setGlucoseVal(baseGlucose + 35);
        setHba1cVal(Math.min(12, Number((baseHba1c + 1.5).toFixed(1))));
        setConditions((prev) => ({ ...prev, diabetes_history: 1 }));
        break;
      case "missed_med":
        setSbpVal(baseSbp + 14);
        setMedications((prev) => ({ ...prev, antihypertensive_med_history: 0 }));
        setTrend("worsening");
        break;
      case "salt_reduction":
        setSbpVal(Math.max(105, baseSbp - 6));
        setDbpVal(Math.max(70, baseDbp - 4));
        break;
    }
  };

  // Save Scenario to Compare list
  const handleSaveScenario = () => {
    if (!simulation || savedScenarios.length >= 3) return;
    const summary = `SBP: ${sbpVal} | Wt: ${weightVal}kg | Trend: ${trend}`;
    const newSaved: SavedScenario = {
      id: `scen-${Date.now()}`,
      name: `Scenario ${savedScenarios.length + 1}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      response: simulation,
      leversSummary: summary,
    };
    setSavedScenarios((prev) => [...prev, newSaved]);
  };

  const hasModifications =
    sbpVal !== baseSbp ||
    dbpVal !== baseDbp ||
    hrVal !== baseHr ||
    weightVal !== baseWeight ||
    glucoseVal !== baseGlucose ||
    hba1cVal !== baseHba1c ||
    trend !== "stable" ||
    Object.keys(customFeatures).length > 0;

  // Advanced features catalog for the searchable table
  const advancedCatalog = useMemo(() => {
    const term = advancedSearch.trim().toLowerCase();
    const all = (featureCatalog as Array<{
      name: string;
      label: string;
      min: number;
      max: number;
      plausible_min: number | null;
      plausible_max: number | null;
      is_cat: boolean;
    }>);
    if (!term) return all;
    return all.filter(
      (f) =>
        f.name.toLowerCase().includes(term) ||
        f.label.toLowerCase().includes(term)
    );
  }, [advancedSearch]);

  const activeCurve = sensitivity?.curves?.[activeCurveVar];

  return (
    <div className="clinical-card p-4 sm:p-5 bg-[var(--bg-surface)] border-[var(--border-hairline)] shadow-2xs space-y-5">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] flex items-center justify-center text-[var(--accent-teal)]">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-bold">
                Clinical Simulation Engine
              </span>
              {loading && (
                <span className="text-[10px] text-[var(--accent-teal)] font-mono animate-pulse">
                  Computing scenario…
                </span>
              )}
            </div>
            <h3 className="font-editorial text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Full Patient Digital Twin Simulator
            </h3>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Compare toggle */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === "live" ? "compare" : "live")}
            className={`px-2.5 py-1 text-xs font-medium border rounded transition-colors ${
              activeTab === "compare"
                ? "bg-[var(--accent-teal)] text-white border-[var(--accent-teal)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {activeTab === "live" ? `Compare Scenarios (${savedScenarios.length})` : "Back to Simulator"}
          </button>

          {hasModifications && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All</span>
            </button>
          )}
        </div>
      </div>

      {/* ── PRESETS BAR ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider text-[11px] mr-1">
          Clinical Presets:
        </span>
        <button
          type="button"
          onClick={() => applyPreset("improve_bp")}
          className="px-2.5 py-1 text-xs bg-[var(--bg-subtle)] hover:bg-[var(--accent-teal-subtle)] border border-[var(--border-hairline)] rounded text-[var(--text-secondary)] hover:text-[var(--accent-teal)] transition-colors"
        >
          Improve BP Control (-15 mmHg)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("weight_loss")}
          className="px-2.5 py-1 text-xs bg-[var(--bg-subtle)] hover:bg-[var(--accent-teal-subtle)] border border-[var(--border-hairline)] rounded text-[var(--text-secondary)] hover:text-[var(--accent-teal)] transition-colors"
        >
          Weight Loss (-7%)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("salt_reduction")}
          className="px-2.5 py-1 text-xs bg-[var(--bg-subtle)] hover:bg-[var(--accent-teal-subtle)] border border-[var(--border-hairline)] rounded text-[var(--text-secondary)] hover:text-[var(--accent-teal)] transition-colors"
        >
          Salt Reduction (-6 mmHg)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("missed_med")}
          className="px-2.5 py-1 text-xs bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 rounded text-rose-800 dark:text-rose-200 transition-colors"
        >
          Missed Medication (+14 mmHg)
        </button>
        <button
          type="button"
          onClick={() => applyPreset("worsening_diabetes")}
          className="px-2.5 py-1 text-xs bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 rounded text-amber-800 dark:text-amber-200 transition-colors"
        >
          Worsening Diabetes (+1.5% HbA1c)
        </button>
      </div>

      {/* ── VIEW TAB: COMPARE VIEW ────────────────────────────────────────── */}
      {activeTab === "compare" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
            <h4 className="font-editorial text-sm font-bold text-[var(--text-primary)]">
              Multi-Scenario Side-by-Side Comparison
            </h4>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded hover:bg-[var(--bg-panel)] text-[var(--text-secondary)] no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export Comparison</span>
            </button>
          </div>

          {savedScenarios.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded border border-dashed border-[var(--border-hairline)]">
              No saved scenarios yet. Adjust levers in the simulator and click &ldquo;Save Scenario&rdquo; to compare up to 3 variations side-by-side.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Baseline column */}
              <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Current Baseline
                </span>
                <div className="font-mono text-xl font-bold text-[var(--text-primary)]">
                  {(simulation ? simulation.baseline_risk * 100 : 0).toFixed(1)}%
                </div>
                <div className="text-xs">
                  <span className={RISK_BADGE_CLASSES[normalizeTier(simulation?.baseline_tier || "LOW")]}>
                    {simulation?.baseline_tier} Risk
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono border-t border-[var(--border-hairline)] pt-2">
                  Raw Proba: {simulation?.baseline_raw.toFixed(4)}
                </div>
              </div>

              {/* Saved scenarios */}
              {savedScenarios.map((scen) => (
                <div key={scen.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--accent-teal-border)] rounded space-y-2 shadow-2xs relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase font-bold text-[var(--accent-teal)]">
                      {scen.name} ({scen.timestamp})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSavedScenarios(savedScenarios.filter((s) => s.id !== scen.id))}
                      className="text-slate-400 hover:text-rose-500"
                      title="Remove scenario"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="font-mono text-xl font-bold text-[var(--text-primary)]">
                    {(scen.response.scenario_risk * 100).toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={RISK_BADGE_CLASSES[normalizeTier(scen.response.scenario_tier)]}>
                      {scen.response.scenario_tier} Risk
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold ${
                        scen.response.delta_risk_pp < 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : scen.response.delta_risk_pp > 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      ({scen.response.delta_risk_pp > 0 ? "+" : ""}
                      {scen.response.delta_risk_pp.toFixed(2)} pp)
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono border-t border-[var(--border-hairline)] pt-1.5 leading-tight">
                    {scen.leversSummary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── VIEW TAB: SIMULATOR (SPLIT EDITOR & LIVE RESULTS) ─────────── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ── LEFT 7 COLS: GROUPED CLINICAL INPUT EDITOR ────────────── */}
          <div className="lg:col-span-7 space-y-4">
            {/* GROUP 1: BLOOD PRESSURE & PULSE */}
            <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Activity className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>Cardiovascular Hemodynamics</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  Pulse Pressure: <strong className="text-[var(--text-primary)]">{sbpVal - dbpVal} mmHg</strong>
                </span>
              </div>

              {/* Systolic BP */}
              <div className={`p-2 rounded border transition-colors ${sbpVal !== baseSbp ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30" : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="sbp-input" className="font-medium text-[var(--text-primary)]">
                    Systolic Blood Pressure
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Orig: {baseSbp} mmHg · Normal &lt; 120
                    </span>
                    <input
                      id="sbp-input"
                      type="number"
                      min={70}
                      max={220}
                      value={sbpVal}
                      onChange={(e) => setSbpVal(Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">mmHg</span>
                    {sbpVal !== baseSbp && (
                      <button
                        type="button"
                        onClick={() => setSbpVal(baseSbp)}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                        title="Reset field"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={70}
                  max={220}
                  step={1}
                  value={sbpVal}
                  onChange={(e) => setSbpVal(Number(e.target.value))}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>

              {/* Diastolic BP */}
              <div className={`p-2 rounded border transition-colors ${dbpVal !== baseDbp ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30" : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="dbp-input" className="font-medium text-[var(--text-primary)]">
                    Diastolic Blood Pressure
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Orig: {baseDbp} mmHg · Normal &lt; 80
                    </span>
                    <input
                      id="dbp-input"
                      type="number"
                      min={40}
                      max={140}
                      value={dbpVal}
                      onChange={(e) => setDbpVal(Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">mmHg</span>
                    {dbpVal !== baseDbp && (
                      <button
                        type="button"
                        onClick={() => setDbpVal(baseDbp)}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                        title="Reset field"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={40}
                  max={140}
                  step={1}
                  value={dbpVal}
                  onChange={(e) => setDbpVal(Number(e.target.value))}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>

              {/* Heart Rate */}
              <div className={`p-2 rounded border transition-colors ${hrVal !== baseHr ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30" : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="hr-input" className="font-medium text-[var(--text-primary)]">
                    Resting Heart Rate
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Orig: {baseHr} bpm · Normal: 60–100
                    </span>
                    <input
                      id="hr-input"
                      type="number"
                      min={40}
                      max={160}
                      value={hrVal}
                      onChange={(e) => setHrVal(Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">bpm</span>
                    {hrVal !== baseHr && (
                      <button
                        type="button"
                        onClick={() => setHrVal(baseHr)}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={40}
                  max={160}
                  step={1}
                  value={hrVal}
                  onChange={(e) => setHrVal(Number(e.target.value))}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>
            </div>

            {/* GROUP 2: BODY COMPOSITION & METABOLIC LABS */}
            <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <Scale className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>Anthropometrics & Metabolic Labs</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">
                  BMI: <strong className="text-[var(--text-primary)]">{currentBmi} kg/m²</strong> · Orig: {baseBmi.toFixed(1)}
                </span>
              </div>

              {/* Weight */}
              <div className={`p-2 rounded border transition-colors ${weightVal !== baseWeight ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30" : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"}`}>
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="wt-input" className="font-medium text-[var(--text-primary)]">
                    Body Weight (kg)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Orig: {baseWeight} kg
                    </span>
                    <input
                      id="wt-input"
                      type="number"
                      step={0.5}
                      min={35}
                      max={180}
                      value={weightVal}
                      onChange={(e) => setWeightVal(Number(e.target.value))}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">kg</span>
                    {weightVal !== baseWeight && (
                      <button
                        type="button"
                        onClick={() => setWeightVal(baseWeight)}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={35}
                  max={180}
                  step={0.5}
                  value={weightVal}
                  onChange={(e) => setWeightVal(Number(e.target.value))}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>

              {/* Glucose & HbA1c side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Glucose */}
                <div className={`p-2 rounded border transition-colors ${glucoseVal !== baseGlucose ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30" : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                    <label htmlFor="gl-input" className="font-medium text-[var(--text-primary)]">
                      Fasting Glucose
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        Orig: {baseGlucose}
                      </span>
                      <input
                        id="gl-input"
                        type="number"
                        min={60}
                        max={350}
                        value={glucoseVal}
                        onChange={(e) => setGlucoseVal(Number(e.target.value))}
                        className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                      />
                      <span className="text-xs text-[var(--text-muted)]">mg/dL</span>
                      {glucoseVal !== baseGlucose && (
                        <button
                          type="button"
                          onClick={() => setGlucoseVal(baseGlucose)}
                          className="text-[10px] text-[var(--accent-teal)] hover:underline ml-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={350}
                    step={1}
                    value={glucoseVal}
                    onChange={(e) => setGlucoseVal(Number(e.target.value))}
                    className="w-full accent-[var(--accent-teal)] cursor-pointer"
                  />
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">Normal: 70–99 mg/dL</div>
                </div>

                {/* HbA1c */}
                <div className={`p-2 rounded border transition-colors ${hba1cVal !== baseHba1c ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30" : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                    <label htmlFor="a1c-input" className="font-medium text-[var(--text-primary)]">
                      HbA1c
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        Orig: {baseHba1c}%
                      </span>
                      <input
                        id="a1c-input"
                        type="number"
                        step={0.1}
                        min={4.0}
                        max={15.0}
                        value={hba1cVal}
                        onChange={(e) => setHba1cVal(Number(e.target.value))}
                        className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                      />
                      <span className="text-xs text-[var(--text-muted)]">%</span>
                      {hba1cVal !== baseHba1c && (
                        <button
                          type="button"
                          onClick={() => setHba1cVal(baseHba1c)}
                          className="text-[10px] text-[var(--accent-teal)] hover:underline ml-1"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={4.0}
                    max={15.0}
                    step={0.1}
                    value={hba1cVal}
                    onChange={(e) => setHba1cVal(Number(e.target.value))}
                    className="w-full accent-[var(--accent-teal)] cursor-pointer"
                  />
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">Normal: &lt; 5.7%</div>
                </div>
              </div>
            </div>

            {/* GROUP 3: TRAJECTORY TREND & CLINICAL TOGGLES */}
            <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>Trajectory Trend & Clinical Profile</span>
                </div>
                {/* Trend selector */}
                <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-0.5 border border-[var(--border-hairline)] rounded">
                  {(["improving", "stable", "worsening"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTrend(t)}
                      className={`px-2 py-0.5 text-[10px] font-mono capitalize rounded transition-colors ${
                        trend === t
                          ? "bg-[var(--accent-teal)] text-white font-bold"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions & Medications Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-1.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={conditions.htn_history === 1}
                    onChange={(e) => setConditions({ ...conditions, htn_history: e.target.checked ? 1 : 0 })}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Hypertension History</span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={conditions.diabetes_history === 1}
                    onChange={(e) => setConditions({ ...conditions, diabetes_history: e.target.checked ? 1 : 0 })}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Type 2 Diabetes History</span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={medications.antihypertensive_med_history === 1}
                    onChange={(e) =>
                      setMedications({ ...medications, antihypertensive_med_history: e.target.checked ? 1 : 0 })
                    }
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Antihypertensive Rx Adherent</span>
                </label>
                <label className="flex items-center gap-2 p-1.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={medications.statin_lipid_med_history === 1}
                    onChange={(e) =>
                      setMedications({ ...medications, statin_lipid_med_history: e.target.checked ? 1 : 0 })
                    }
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Statin / Lipid-Lowering Rx</span>
                </label>
              </div>
            </div>

            {/* GROUP 4: ADVANCED SEARCHABLE FEATURE TABLE */}
            <div className="border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)]">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Advanced: Inspect & Edit Remaining Model Features ({advancedCatalog.length})</span>
                </span>
                {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="p-3 border-t border-[var(--border-hairline)] space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search remaining 132 features (e.g., encounters, recency)..."
                      value={advancedSearch}
                      onChange={(e) => setAdvancedSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="max-h-60 overflow-y-auto overflow-x-auto responsive-table-container border border-[var(--border-hairline)] rounded text-xs">
                    <table className="w-full min-w-[500px] text-left">
                      <thead className="bg-[var(--bg-subtle)] sticky top-0 text-[10px] text-[var(--text-muted)] uppercase font-mono">
                        <tr>
                          <th className="p-2">Feature Name</th>
                          <th className="p-2">Allowed Range</th>
                          <th className="p-2 text-center">Orig Value</th>
                          <th className="p-2 text-right">Scenario Value</th>
                          <th className="p-2 text-center w-14">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)]">
                        {advancedCatalog.map((item) => {
                          const origVal =
                            featureRow?.[item.name] !== undefined
                              ? Number(featureRow[item.name])
                              : (item.plausible_min ?? item.min);
                          const isEdited =
                            customFeatures[item.name] !== undefined &&
                            customFeatures[item.name] !== origVal;
                          const currentVal =
                            customFeatures[item.name] !== undefined
                              ? customFeatures[item.name]
                              : origVal;

                          return (
                            <tr
                              key={item.name}
                              className={`hover:bg-[var(--bg-subtle)] transition-colors ${
                                isEdited ? "bg-teal-50/60 dark:bg-teal-950/40 font-medium" : ""
                              }`}
                            >
                              <td className="p-2">
                                <div className="font-medium text-[var(--text-primary)]">{item.label}</div>
                                <div className="font-mono text-[9px] text-[var(--text-muted)]">{item.name}</div>
                              </td>
                              <td className="p-2 text-[10px] font-mono text-[var(--text-muted)]">
                                [{item.min}, {item.max}]
                              </td>
                              <td className="p-2 text-center text-[10px] font-mono text-[var(--text-secondary)]">
                                {origVal}
                              </td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  min={item.min}
                                  max={item.max}
                                  value={currentVal}
                                  onChange={(e) =>
                                    setCustomFeatures({
                                      ...customFeatures,
                                      [item.name]: Number(e.target.value),
                                    })
                                  }
                                  className={`w-20 px-1.5 py-0.5 text-xs font-mono text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] ${
                                    isEdited
                                      ? "border-[var(--accent-teal)] font-bold text-[var(--accent-teal)]"
                                      : ""
                                  }`}
                                />
                              </td>
                              <td className="p-2 text-center">
                                {isEdited && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomFeatures((prev) => {
                                        const next = { ...prev };
                                        delete next[item.name];
                                        return next;
                                      });
                                    }}
                                    className="text-[10px] text-[var(--accent-teal)] hover:underline font-mono"
                                    title="Reset feature"
                                  >
                                    Reset
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT 5 COLS: LIVE RESULTS, SHAP DIFF, SENSITIVITY CURVES ──── */}
          <div className="lg:col-span-5 space-y-4">
            {/* BEFORE & AFTER CARDS */}
            {simulation && (
              <div className="p-4 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)]">
                    Scenario Projection
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveScenario}
                    disabled={savedScenarios.length >= 3}
                    className="flex items-center gap-1 text-[11px] px-2 py-0.5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] disabled:opacity-50"
                  >
                    <Save className="w-3 h-3 text-[var(--accent-teal)]" />
                    <span>Save ({savedScenarios.length}/3)</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Baseline Card */}
                  <div className="p-3 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-1">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono">Baseline</span>
                    <div className="font-mono text-xl font-bold text-[var(--text-primary)]">
                      {(simulation.baseline_risk * 100).toFixed(1)}%
                    </div>
                    <span className={RISK_BADGE_CLASSES[normalizeTier(simulation.baseline_tier)]}>
                      {simulation.baseline_tier} Tier
                    </span>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono pt-1">
                      Raw: {simulation.baseline_raw.toFixed(4)}
                    </div>
                  </div>

                  {/* Scenario Card */}
                  <div className="p-3 bg-[var(--bg-surface)] rounded border border-[var(--accent-teal-border)] space-y-1 shadow-2xs">
                    <span className="text-[10px] text-[var(--accent-teal)] uppercase font-mono font-bold">
                      Simulated
                    </span>
                    <div className="font-mono text-xl font-bold text-[var(--text-primary)]">
                      {(simulation.scenario_risk * 100).toFixed(1)}%
                    </div>
                    <span className={RISK_BADGE_CLASSES[normalizeTier(simulation.scenario_tier)]}>
                      {simulation.scenario_tier} Tier
                    </span>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono pt-1">
                      Raw: {simulation.scenario_raw.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Delta Display */}
                <div className="flex items-center justify-between p-2.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] text-xs font-mono">
                  <span className="text-[var(--text-secondary)]">Absolute Shift:</span>
                  <span
                    className={`font-bold text-sm ${
                      simulation.delta_risk_pp < 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : simulation.delta_risk_pp > 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {simulation.delta_risk_pp > 0 ? "+" : ""}
                    {simulation.delta_risk_pp.toFixed(2)} pp
                  </span>
                </div>

                {/* WARNINGS / LOW SENSITIVITY NOTICES */}
                {simulation.is_out_of_range && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                    <div className="space-y-0.5">
                      <strong className="font-bold">OUT_OF_RANGE Warning:</strong>
                      <div className="text-[11px] leading-relaxed">
                        Hypothetical input values exceed the model&rsquo;s 99th percentile training distribution.
                      </div>
                    </div>
                  </div>
                )}

                {simulation.is_low_sensitivity && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <strong className="font-bold">LOW_SENSITIVITY Notice:</strong>
                      <div className="text-[11px] leading-relaxed">
                        The model does not rely on this input for this patient profile (underlying tree split threshold was not crossed).
                      </div>
                    </div>
                  </div>
                )}

                {/* WHAT DROVE THE CHANGE: SHAP DIFF BAR CHART */}
                {simulation.shap_diff && simulation.shap_diff.length > 0 && (
                  <div className="p-3 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)]">
                      <span>What Drove the Change (SHAP Impact Shift)</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-normal">Attribution Δ</span>
                    </div>

                    <div className="space-y-1.5">
                      {simulation.shap_diff.slice(0, 5).map((item) => (
                        <div key={item.feature} className="text-[11px] space-y-0.5">
                          <div className="flex justify-between">
                            <span className="text-[var(--text-primary)] truncate max-w-[200px]">
                              {item.human_name}
                            </span>
                            <span
                              className={`font-mono font-bold ${
                                item.attribution_diff < 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : item.attribution_diff > 0
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-[var(--text-faint)]"
                              }`}
                            >
                              {item.attribution_diff > 0 ? "+" : ""}
                              {item.attribution_diff.toFixed(4)}
                            </span>
                          </div>
                          <div className="h-1 bg-[var(--bg-subtle)] rounded-full overflow-hidden flex">
                            {item.attribution_diff < 0 ? (
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.abs(item.attribution_diff) * 200)}%` }}
                              />
                            ) : (
                              <div
                                className="h-full bg-rose-500 rounded-full ml-auto"
                                style={{ width: `${Math.min(100, Math.abs(item.attribution_diff) * 200)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FULL LIST OF FEATURES SHIFTED */}
                {simulation.features_changed.length > 0 && (
                  <div className="p-2.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] text-[var(--text-secondary)] font-medium">
                      <span>Correlated Features Shifted ({simulation.features_changed.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {simulation.features_changed.map((col) => (
                        <span
                          key={col}
                          className="px-1.5 py-0.5 text-[9px] font-mono bg-[var(--accent-teal-subtle)] text-[var(--accent-teal)] border border-[var(--accent-teal-border)] rounded"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SENSITIVITY CURVES WITH CURRENT VALUE MARKED */}
            {sensitivity && activeCurve && (
              <div className="p-3.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Model Sensitivity Response Curve
                  </span>
                  {/* Variable selector */}
                  <div className="flex gap-1 text-[10px] font-mono">
                    {["sbp", "dbp", "weight", "hr", "glucose"].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setActiveCurveVar(k)}
                        className={`px-1.5 py-0.5 rounded uppercase transition-colors ${
                          activeCurveVar === k
                            ? "bg-[var(--accent-teal)] text-white font-bold"
                            : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]"
                        }`}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                  Visualizes step thresholds of the underlying XGBoost trees for{" "}
                  <strong className="text-[var(--text-primary)]">{activeCurve.display_name}</strong>. Current value marked with green dot.
                </p>

                {/* SVG Curve Chart */}
                <div className="h-28 w-full bg-[var(--bg-subtle)] rounded p-2 border border-[var(--border-hairline)] relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50" preserveAspectRatio="none">
                    {/* Render step curve line */}
                    {(() => {
                      const pts = activeCurve.points;
                      if (!pts || pts.length === 0) return null;
                      const minRisk = Math.min(...pts.map((p) => p.calibrated_risk));
                      const maxRisk = Math.max(...pts.map((p) => p.calibrated_risk)) || 0.01;
                      const path = pts
                        .map((p, idx) => {
                          const x = (idx / (pts.length - 1)) * 100;
                          const normY = maxRisk === minRisk ? 25 : 45 - ((p.calibrated_risk - minRisk) / (maxRisk - minRisk)) * 38;
                          return `${idx === 0 ? "M" : "L"} ${x} ${normY}`;
                        })
                        .join(" ");

                      // Closest point to current value
                      let closestIdx = 0;
                      let minDiff = Infinity;
                      pts.forEach((p, idx) => {
                        const diff = Math.abs(p.value - activeCurve.current_value);
                        if (diff < minDiff) {
                          minDiff = diff;
                          closestIdx = idx;
                        }
                      });
                      const currPt = pts[closestIdx];
                      const currX = (closestIdx / (pts.length - 1)) * 100;
                      const currY = maxRisk === minRisk ? 25 : 45 - ((currPt.calibrated_risk - minRisk) / (maxRisk - minRisk)) * 38;

                      return (
                        <>
                          <path d={path} fill="none" stroke="var(--accent-teal)" strokeWidth="2" strokeLinecap="round" />
                          {/* Current Value Indicator */}
                          <line x1={currX} y1={0} x2={currX} y2={50} stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
                          <circle cx={currX} cy={currY} r="3" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
                  <span>
                    Min: {activeCurve.points[0]?.value} {activeCurve.unit}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Current: {activeCurve.current_value} {activeCurve.unit}
                  </span>
                  <span>
                    Max: {activeCurve.points[activeCurve.points.length - 1]?.value} {activeCurve.unit}
                  </span>
                </div>
              </div>
            )}

            {/* MANDATORY CAUTION BOX */}
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Clinical Model Notice:</strong> Shows how this model&rsquo;s score reacts to the changed inputs on synthetic data. It does not predict the effect of a real treatment, and covers hypertension progression only.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchSimulate,
  fetchSensitivity,
  SimulateRequest,
  SimulateResponse,
  SensitivityResponse,
  OutOfRangeDetail,
  DependentFeatureSummary,
} from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  Sliders,
  RotateCcw,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  Scale,
  Search,
  Save,
  Trash2,
  Printer,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  HelpCircle,
  Layers,
  Sparkles,
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
  snapshotVitals: {
    sbp: number;
    dbp: number;
    hr: number;
    weight: number;
    glucose: number;
    hba1c: number;
    trend: "improving" | "stable" | "worsening";
    conditions: Record<string, number>;
    medications: Record<string, number>;
    customFeatures: Record<string, number>;
    modelHistoricalTrajectory: boolean;
  };
}

interface ClinicalPresetDef {
  id: string;
  name: string;
  badge: string;
  description: string;
  assumptions: string;
  apply: (base: {
    sbp: number;
    dbp: number;
    hr: number;
    weight: number;
    glucose: number;
    hba1c: number;
  }) => {
    sbp?: number;
    dbp?: number;
    hr?: number;
    weight?: number;
    glucose?: number;
    hba1c?: number;
    trend?: "improving" | "stable" | "worsening";
    conditionUpdates?: Record<string, number>;
    medicationUpdates?: Record<string, number>;
  };
}

const CLINICAL_PRESETS: ClinicalPresetDef[] = [
  {
    id: "improve_bp",
    name: "Improve BP Control (-15 mmHg)",
    badge: "-15 SBP / -8 DBP",
    description: "Models blood pressure normalization through intensified antihypertensive management or lifestyle modification.",
    assumptions: "Hypothetical scenario assuming patient achieves 15 mmHg SBP and 8 mmHg DBP reduction with an improving clinical trend. Does not prove clinical event avoidance.",
    apply: (base) => ({
      sbp: Math.max(85, base.sbp - 15),
      dbp: Math.max(50, base.dbp - 8),
      trend: "improving",
      medicationUpdates: { antihypertensive_med_history: 1 },
    }),
  },
  {
    id: "weight_loss",
    name: "Weight Loss (-7%)",
    badge: "-7% Total Body Mass",
    description: "Simulates a 7% reduction in total body weight via nutritional intervention or medical weight management.",
    assumptions: "Recalculates body mass index (BMI) proportionately based on height. Preserves baseline hemodynamic markers.",
    apply: (base) => ({
      weight: Math.max(35, Math.round(base.weight * 0.93 * 10) / 10),
      trend: "improving",
    }),
  },
  {
    id: "salt_reduction",
    name: "Salt Reduction (-6 mmHg)",
    badge: "-6 SBP / -4 DBP",
    description: "Models modest dietary sodium restriction leading to physiological volume and systemic vascular resistance reduction.",
    assumptions: "Non-pharmacological dietary shift. Assumes no other metabolic parameters or medications are altered.",
    apply: (base) => ({
      sbp: Math.max(85, base.sbp - 6),
      dbp: Math.max(50, base.dbp - 4),
      trend: "stable",
    }),
  },
  {
    id: "missed_med",
    name: "Missed Medication (+14 mmHg)",
    badge: "+14 SBP / Non-adherent",
    description: "Simulates acute treatment non-adherence or medication discontinuation (+14 mmHg SBP, +8 mmHg DBP).",
    assumptions: "De-selects antihypertensive adherence flag and models worsening clinical trend. Hemodynamics elevate above baseline.",
    apply: (base) => ({
      sbp: base.sbp + 14,
      dbp: base.dbp + 8,
      trend: "worsening",
      medicationUpdates: { antihypertensive_med_history: 0 },
    }),
  },
  {
    id: "worsening_diabetes",
    name: "Worsening Diabetes (+1.5% HbA1c)",
    badge: "+35 mg/dL Glucose / +1.5% A1c",
    description: "Models progressive glycemic deterioration (+35 mg/dL fasting glucose, +1.5% HbA1c).",
    assumptions: "Enables type 2 diabetes history flag and sets a worsening trajectory. Note: Extreme values may exceed the synthetic cohort training distribution.",
    apply: (base) => ({
      glucose: base.glucose + 35,
      hba1c: Math.min(15, Number((base.hba1c + 1.5).toFixed(1))),
      trend: "worsening",
      conditionUpdates: { diabetes_history: 1 },
    }),
  },
];

export function PatientSimulator({
  patientId,
  initialVitals = {},
  featureRow,
  onScenarioChange,
}: PatientSimulatorProps) {
  // Baseline initial values: Prioritize the model's actual feature_row values so controls,
  // sensitivity curves, and advanced feature table start from identical points.
  const baseSbp = useMemo(
    () =>
      featureRow?.sbp_latest !== undefined && featureRow?.sbp_latest !== null
        ? Number(featureRow.sbp_latest)
        : initialVitals.sbp ?? 125,
    [featureRow?.sbp_latest, initialVitals.sbp]
  );

  const baseDbp = useMemo(
    () =>
      featureRow?.dbp_latest !== undefined && featureRow?.dbp_latest !== null
        ? Number(featureRow.dbp_latest)
        : initialVitals.dbp ?? 80,
    [featureRow?.dbp_latest, initialVitals.dbp]
  );

  const baseHr = useMemo(
    () =>
      featureRow?.hr_latest !== undefined && featureRow?.hr_latest !== null
        ? Number(featureRow.hr_latest)
        : initialVitals.hr ?? 72,
    [featureRow?.hr_latest, initialVitals.hr]
  );

  const baseWeight = useMemo(
    () =>
      featureRow?.weight_latest !== undefined && featureRow?.weight_latest !== null
        ? Number(featureRow.weight_latest)
        : initialVitals.weight ?? 70,
    [featureRow?.weight_latest, initialVitals.weight]
  );

  const baseBmi = useMemo(
    () =>
      featureRow?.bmi_latest !== undefined && featureRow?.bmi_latest !== null
        ? Number(featureRow.bmi_latest)
        : initialVitals.bmi ?? Number((baseWeight / (1.7 * 1.7)).toFixed(1)),
    [featureRow?.bmi_latest, initialVitals.bmi, baseWeight]
  );

  const baseGlucose = useMemo(
    () =>
      featureRow?.glucose_latest !== undefined && featureRow?.glucose_latest !== null
        ? Number(featureRow.glucose_latest)
        : initialVitals.glucose ?? 100,
    [featureRow?.glucose_latest, initialVitals.glucose]
  );

  const baseHba1c = useMemo(
    () =>
      featureRow?.hba1c_latest !== undefined && featureRow?.hba1c_latest !== null
        ? Number(featureRow.hba1c_latest)
        : initialVitals.hba1c ?? 5.6,
    [featureRow?.hba1c_latest, initialVitals.hba1c]
  );

  // Baseline conditions and medications extracted dynamically from patient's actual featureRow
  const defaultConditions = useMemo(
    () => ({
      htn_history: featureRow?.htn_history !== undefined ? Number(featureRow.htn_history) : 0,
      diabetes_history: featureRow?.diabetes_history !== undefined ? Number(featureRow.diabetes_history) : 0,
      obesity_history: featureRow?.obesity_history !== undefined ? Number(featureRow.obesity_history) : 0,
      cvd_history: featureRow?.cvd_history !== undefined ? Number(featureRow.cvd_history) : 0,
      ckd_history: featureRow?.ckd_history !== undefined ? Number(featureRow.ckd_history) : 0,
    }),
    [featureRow]
  );

  const defaultMedications = useMemo(
    () => ({
      antihypertensive_med_history:
        featureRow?.antihypertensive_med_history !== undefined
          ? Number(featureRow.antihypertensive_med_history)
          : 0,
      antidiabetic_med_history:
        featureRow?.antidiabetic_med_history !== undefined
          ? Number(featureRow.antidiabetic_med_history)
          : 0,
      statin_lipid_med_history:
        featureRow?.statin_lipid_med_history !== undefined
          ? Number(featureRow.statin_lipid_med_history)
          : 0,
    }),
    [featureRow]
  );

  // Primary Clinical Levers State
  const [sbpVal, setSbpVal] = useState<number>(baseSbp);
  const [dbpVal, setDbpVal] = useState<number>(baseDbp);
  const [hrVal, setHrVal] = useState<number>(baseHr);
  const [weightVal, setWeightVal] = useState<number>(baseWeight);
  const [glucoseVal, setGlucoseVal] = useState<number>(baseGlucose);
  const [hba1cVal, setHba1cVal] = useState<number>(baseHba1c);
  const [trend, setTrend] = useState<"improving" | "stable" | "worsening">("stable");
  const [modelHistoricalTrajectory, setModelHistoricalTrajectory] = useState<boolean>(false);

  // Active preset tracker
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Condition & Medication Toggles
  const [conditions, setConditions] = useState<Record<string, number>>(defaultConditions);
  const [medications, setMedications] = useState<Record<string, number>>(defaultMedications);

  // Advanced Table Tweaks
  const [advancedSearch, setAdvancedSearch] = useState<string>("");
  const [customFeatures, setCustomFeatures] = useState<Record<string, number>>({});
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showCorrelatedDetails, setShowCorrelatedDetails] = useState<boolean>(false);

  // Simulation & Sensitivity Data
  const [simulation, setSimulation] = useState<SimulateResponse | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [activeCurveVar, setActiveCurveVar] = useState<string>("sbp");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Saved Scenarios for Side-by-Side Comparison (Max 3)
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
    setModelHistoricalTrajectory(false);
    setActivePresetId(null);
    setConditions(defaultConditions);
    setMedications(defaultMedications);
    setCustomFeatures({});
  }, [patientId, baseSbp, baseDbp, baseHr, baseWeight, baseGlucose, baseHba1c, defaultConditions, defaultMedications]);

  // Load Sensitivity Curves on patient mount
  useEffect(() => {
    if (!patientId) return;
    fetchSensitivity(patientId)
      .then((data) => setSensitivity(data))
      .catch((err) => console.warn("Sensitivity data unavailable:", err));
  }, [patientId]);

  // Derived current BMI based on proportional weight ratio
  const currentBmi = useMemo(() => {
    if (baseWeight <= 0) return baseBmi;
    return Number((baseBmi * (weightVal / baseWeight)).toFixed(1));
  }, [weightVal, baseWeight, baseBmi]);

  // Derived current Pulse Pressure (SBP - DBP)
  const currentPulsePressure = useMemo(() => sbpVal - dbpVal, [sbpVal, dbpVal]);

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
        model_historical_trajectory: modelHistoricalTrajectory,
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
          pulse_pressure: currentPulsePressure,
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
    modelHistoricalTrajectory,
    currentBmi,
    currentPulsePressure,
    onScenarioChange,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 280);
    return () => clearTimeout(timer);
  }, [runSimulation]);

  // Clean Reset All to Baseline
  const handleResetAll = () => {
    setSbpVal(baseSbp);
    setDbpVal(baseDbp);
    setHrVal(baseHr);
    setWeightVal(baseWeight);
    setGlucoseVal(baseGlucose);
    setHba1cVal(baseHba1c);
    setTrend("stable");
    setModelHistoricalTrajectory(false);
    setActivePresetId(null);
    setConditions(defaultConditions);
    setMedications(defaultMedications);
    setCustomFeatures({});
    if (onScenarioChange) onScenarioChange(null, undefined);
  };

  // Preset Selection Handler
  const handleApplyPreset = (preset: ClinicalPresetDef) => {
    // Presets always start from clean baseline values, preventing accidental accumulation
    const updates = preset.apply({
      sbp: baseSbp,
      dbp: baseDbp,
      hr: baseHr,
      weight: baseWeight,
      glucose: baseGlucose,
      hba1c: baseHba1c,
    });

    setSbpVal(updates.sbp ?? baseSbp);
    setDbpVal(updates.dbp ?? baseDbp);
    setHrVal(updates.hr ?? baseHr);
    setWeightVal(updates.weight ?? baseWeight);
    setGlucoseVal(updates.glucose ?? baseGlucose);
    setHba1cVal(updates.hba1c ?? baseHba1c);
    setTrend(updates.trend ?? "stable");

    setConditions({
      ...defaultConditions,
      ...(updates.conditionUpdates || {}),
    });

    setMedications({
      ...defaultMedications,
      ...(updates.medicationUpdates || {}),
    });

    setCustomFeatures({});
    setActivePresetId(preset.id);
  };

  // Save Scenario to Compare list (Deep Cloned to prevent mutation when sliders move)
  const handleSaveScenario = () => {
    if (!simulation || savedScenarios.length >= 3) return;

    const summary = `SBP: ${sbpVal} mmHg | Wt: ${weightVal} kg | Glu: ${glucoseVal} mg/dL | Trend: ${trend}`;
    const newSaved: SavedScenario = {
      id: `scen-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `Scenario ${savedScenarios.length + 1}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      // Deep clone response to guarantee snapshot immutability
      response: JSON.parse(JSON.stringify(simulation)),
      leversSummary: summary,
      snapshotVitals: {
        sbp: sbpVal,
        dbp: dbpVal,
        hr: hrVal,
        weight: weightVal,
        glucose: glucoseVal,
        hba1c: hba1cVal,
        trend,
        conditions: { ...conditions },
        medications: { ...medications },
        customFeatures: { ...customFeatures },
        modelHistoricalTrajectory,
      },
    };
    setSavedScenarios((prev) => [...prev, newSaved]);
  };

  // Restore a saved scenario back into the simulator sliders
  const handleLoadScenario = (scen: SavedScenario) => {
    setSbpVal(scen.snapshotVitals.sbp);
    setDbpVal(scen.snapshotVitals.dbp);
    setHrVal(scen.snapshotVitals.hr);
    setWeightVal(scen.snapshotVitals.weight);
    setGlucoseVal(scen.snapshotVitals.glucose);
    setHba1cVal(scen.snapshotVitals.hba1c);
    setTrend(scen.snapshotVitals.trend);
    setConditions(scen.snapshotVitals.conditions);
    setMedications(scen.snapshotVitals.medications);
    setCustomFeatures(scen.snapshotVitals.customFeatures);
    setModelHistoricalTrajectory(scen.snapshotVitals.modelHistoricalTrajectory);
    setActivePresetId(null);
    setActiveTab("live");
  };

  const hasModifications =
    sbpVal !== baseSbp ||
    dbpVal !== baseDbp ||
    hrVal !== baseHr ||
    weightVal !== baseWeight ||
    glucoseVal !== baseGlucose ||
    hba1cVal !== baseHba1c ||
    trend !== "stable" ||
    modelHistoricalTrajectory !== false ||
    activePresetId !== null ||
    Object.keys(customFeatures).length > 0;

  // Active preset metadata if one is currently selected
  const activePresetDef = useMemo(
    () => CLINICAL_PRESETS.find((p) => p.id === activePresetId) || null,
    [activePresetId]
  );

  // Advanced features catalog for the searchable table
  const advancedCatalog = useMemo(() => {
    const term = advancedSearch.trim().toLowerCase();
    const all = featureCatalog as Array<{
      name: string;
      label: string;
      min: number;
      max: number;
      plausible_min: number | null;
      plausible_max: number | null;
      is_cat: boolean;
    }>;
    if (!term) return all;
    return all.filter(
      (f) => f.name.toLowerCase().includes(term) || f.label.toLowerCase().includes(term)
    );
  }, [advancedSearch]);

  const activeCurve = sensitivity?.curves?.[activeCurveVar];

  return (
    <div className="clinical-card p-3 sm:p-5 bg-[var(--bg-surface)] border-[var(--border-hairline)] shadow-2xs space-y-5 w-full overflow-hidden">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[var(--accent-teal-subtle)] border border-[var(--accent-teal-border)] flex items-center justify-center text-[var(--accent-teal)] shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-bold">
                Clinical Simulation Engine
              </span>
              {loading && (
                <span className="text-[10px] text-[var(--accent-teal)] font-mono animate-pulse no-print" role="status">
                  Computing scenario…
                </span>
              )}
            </div>
            <h3 className="font-editorial text-base sm:text-lg font-bold text-[var(--text-primary)] leading-tight">
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
            {activeTab === "live" ? `Compare Scenarios (${savedScenarios.length}/3)` : "Back to Simulator"}
          </button>

          {hasModifications && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset to Baseline</span>
            </button>
          )}
        </div>
      </div>

      {/* ── PRESETS BAR ───────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mr-1">
            Clinical Presets:
          </span>
          {CLINICAL_PRESETS.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  isActive
                    ? "bg-[var(--accent-teal)] text-white border-[var(--accent-teal)] font-bold shadow-xs"
                    : "bg-[var(--bg-subtle)] hover:bg-[var(--accent-teal-subtle)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--accent-teal)]"
                }`}
                title={preset.description}
              >
                {preset.name}
              </button>
            );
          })}
        </div>

        {/* Active Preset Explainer Banner */}
        {activePresetDef && (
          <div className="p-2.5 bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded text-xs text-teal-900 dark:text-teal-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Active Preset: {activePresetDef.name} ({activePresetDef.badge})
              </span>
              <button
                type="button"
                onClick={handleResetAll}
                className="text-[11px] text-teal-700 dark:text-teal-300 hover:underline font-mono"
              >
                Clear Preset
              </button>
            </div>
            <p className="text-[11px] text-teal-800/90 dark:text-teal-300/90 leading-relaxed">
              <strong>Clinical Assumption:</strong> {activePresetDef.assumptions}
            </p>
          </div>
        )}
      </div>

      {/* ── VIEW TAB: COMPARE VIEW ────────────────────────────────────────── */}
      {activeTab === "compare" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
            <div>
              <h4 className="font-editorial text-sm font-bold text-[var(--text-primary)]">
                Multi-Scenario Side-by-Side Comparison
              </h4>
              <p className="text-[11px] text-[var(--text-muted)]">
                Compare baseline risk alongside up to 3 saved digital twin counterfactuals.
              </p>
            </div>
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
            <div className="p-6 sm:p-8 text-center text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] rounded border border-dashed border-[var(--border-hairline)] space-y-1">
              <p className="font-medium text-[var(--text-secondary)]">No saved scenarios yet.</p>
              <p>Adjust levers in the simulator and click &ldquo;Save Scenario ({savedScenarios.length}/3)&rdquo; to compare variations side-by-side.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Baseline column */}
              <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)]">
                  Current Baseline
                </span>
                <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                  {(simulation ? simulation.baseline_risk * 100 : 0).toFixed(1)}%
                </div>
                <div className="text-xs">
                  <span className={RISK_BADGE_CLASSES[normalizeTier(simulation?.baseline_tier || "LOW")]}>
                    {simulation?.baseline_tier} Risk
                  </span>
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono border-t border-[var(--border-hairline)] pt-2 space-y-0.5">
                  <div>Raw Margin Proba: {simulation?.baseline_raw.toFixed(4)}</div>
                  <div className="text-[10px] text-[var(--text-faint)]">Validated Synthetic Cohort Baseline</div>
                </div>
              </div>

              {/* Saved scenarios */}
              {savedScenarios.map((scen) => {
                const isOOD = scen.response.is_out_of_range;
                return (
                  <div
                    key={scen.id}
                    className={`p-3 bg-[var(--bg-surface)] rounded space-y-2 shadow-2xs relative border ${
                      isOOD
                        ? "border-amber-300 dark:border-amber-700/80 bg-amber-50/20"
                        : "border-[var(--accent-teal-border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase font-bold text-[var(--accent-teal)]">
                        {scen.name} ({scen.timestamp})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSavedScenarios(savedScenarios.filter((s) => s.id !== scen.id))}
                        className="text-slate-400 hover:text-rose-500 p-0.5"
                        title="Remove scenario"
                        aria-label={`Remove ${scen.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="font-mono text-2xl font-bold text-[var(--text-primary)] flex items-baseline gap-1.5">
                      {(scen.response.scenario_risk * 100).toFixed(1)}%
                      {isOOD && (
                        <span className="text-[10px] px-1 py-0.2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 font-mono rounded">
                          OOD
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={RISK_BADGE_CLASSES[normalizeTier(scen.response.scenario_tier)]}>
                        {scen.response.scenario_tier} Risk
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold ${
                          isOOD
                            ? "text-amber-700 dark:text-amber-300"
                            : scen.response.delta_risk_pp < 0
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

                    <button
                      type="button"
                      onClick={() => handleLoadScenario(scen)}
                      className="w-full mt-2 py-1 text-[11px] bg-[var(--bg-subtle)] hover:bg-[var(--accent-teal-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-teal)] border border-[var(--border-hairline)] rounded font-medium transition-colors"
                    >
                      Load into Simulator
                    </button>
                  </div>
                );
              })}
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
                  Pulse Pressure: <strong className="text-[var(--text-primary)]">{currentPulsePressure} mmHg</strong>
                </span>
              </div>

              {/* Systolic BP */}
              <div
                className={`p-2.5 rounded border transition-colors ${
                  sbpVal !== baseSbp
                    ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="sbp-input" className="font-medium text-[var(--text-primary)]">
                    Systolic Blood Pressure
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Baseline: {baseSbp} mmHg · Normal &lt; 120
                    </span>
                    <input
                      id="sbp-input"
                      type="number"
                      min={70}
                      max={220}
                      value={sbpVal}
                      onChange={(e) => {
                        setActivePresetId(null);
                        setSbpVal(Number(e.target.value));
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">mmHg</span>
                    {sbpVal !== baseSbp && (
                      <button
                        type="button"
                        onClick={() => {
                          setActivePresetId(null);
                          setSbpVal(baseSbp);
                        }}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                        title="Reset SBP to baseline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="Systolic Blood Pressure"
                  min={70}
                  max={220}
                  step={1}
                  value={sbpVal}
                  onChange={(e) => {
                    setActivePresetId(null);
                    setSbpVal(Number(e.target.value));
                  }}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>

              {/* Diastolic BP */}
              <div
                className={`p-2.5 rounded border transition-colors ${
                  dbpVal !== baseDbp
                    ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="dbp-input" className="font-medium text-[var(--text-primary)]">
                    Diastolic Blood Pressure
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Baseline: {baseDbp} mmHg · Normal &lt; 80
                    </span>
                    <input
                      id="dbp-input"
                      type="number"
                      min={40}
                      max={140}
                      value={dbpVal}
                      onChange={(e) => {
                        setActivePresetId(null);
                        setDbpVal(Number(e.target.value));
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">mmHg</span>
                    {dbpVal !== baseDbp && (
                      <button
                        type="button"
                        onClick={() => {
                          setActivePresetId(null);
                          setDbpVal(baseDbp);
                        }}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                        title="Reset DBP to baseline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="Diastolic Blood Pressure"
                  min={40}
                  max={140}
                  step={1}
                  value={dbpVal}
                  onChange={(e) => {
                    setActivePresetId(null);
                    setDbpVal(Number(e.target.value));
                  }}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>

              {/* Heart Rate */}
              <div
                className={`p-2.5 rounded border transition-colors ${
                  hrVal !== baseHr
                    ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="hr-input" className="font-medium text-[var(--text-primary)]">
                    Resting Heart Rate
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Baseline: {baseHr} bpm · Normal: 60–100
                    </span>
                    <input
                      id="hr-input"
                      type="number"
                      min={40}
                      max={160}
                      value={hrVal}
                      onChange={(e) => {
                        setActivePresetId(null);
                        setHrVal(Number(e.target.value));
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">bpm</span>
                    {hrVal !== baseHr && (
                      <button
                        type="button"
                        onClick={() => {
                          setActivePresetId(null);
                          setHrVal(baseHr);
                        }}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                        title="Reset HR to baseline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="Resting Heart Rate"
                  min={40}
                  max={160}
                  step={1}
                  value={hrVal}
                  onChange={(e) => {
                    setActivePresetId(null);
                    setHrVal(Number(e.target.value));
                  }}
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
                  Calculated BMI: <strong className="text-[var(--text-primary)]">{currentBmi} kg/m²</strong> (Baseline: {baseBmi.toFixed(1)})
                </span>
              </div>

              {/* Weight */}
              <div
                className={`p-2.5 rounded border transition-colors ${
                  weightVal !== baseWeight
                    ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30"
                    : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                  <label htmlFor="wt-input" className="font-medium text-[var(--text-primary)]">
                    Body Weight (kg)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Baseline: {baseWeight} kg
                    </span>
                    <input
                      id="wt-input"
                      type="number"
                      step={0.5}
                      min={35}
                      max={180}
                      value={weightVal}
                      onChange={(e) => {
                        setActivePresetId(null);
                        setWeightVal(Number(e.target.value));
                      }}
                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">kg</span>
                    {weightVal !== baseWeight && (
                      <button
                        type="button"
                        onClick={() => {
                          setActivePresetId(null);
                          setWeightVal(baseWeight);
                        }}
                        className="text-[10px] text-[var(--accent-teal)] hover:underline"
                        title="Reset Weight to baseline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  aria-label="Body Weight"
                  min={35}
                  max={180}
                  step={0.5}
                  value={weightVal}
                  onChange={(e) => {
                    setActivePresetId(null);
                    setWeightVal(Number(e.target.value));
                  }}
                  className="w-full accent-[var(--accent-teal)] cursor-pointer"
                />
              </div>

              {/* Glucose & HbA1c side-by-side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Glucose */}
                <div
                  className={`p-2.5 rounded border transition-colors ${
                    glucoseVal !== baseGlucose
                      ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                    <label htmlFor="gl-input" className="font-medium text-[var(--text-primary)]">
                      Fasting Glucose
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        Base: {baseGlucose}
                      </span>
                      <input
                        id="gl-input"
                        type="number"
                        min={60}
                        max={350}
                        value={glucoseVal}
                        onChange={(e) => {
                          setActivePresetId(null);
                          setGlucoseVal(Number(e.target.value));
                        }}
                        className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                      />
                      <span className="text-xs text-[var(--text-muted)]">mg/dL</span>
                      {glucoseVal !== baseGlucose && (
                        <button
                          type="button"
                          onClick={() => {
                            setActivePresetId(null);
                            setGlucoseVal(baseGlucose);
                          }}
                          className="text-[10px] text-[var(--accent-teal)] hover:underline ml-1"
                          title="Reset Glucose"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    aria-label="Fasting Glucose"
                    min={60}
                    max={350}
                    step={1}
                    value={glucoseVal}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setGlucoseVal(Number(e.target.value));
                    }}
                    className="w-full accent-[var(--accent-teal)] cursor-pointer"
                  />
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                    Cohort 99th: ~121.4 mg/dL
                  </div>
                </div>

                {/* HbA1c */}
                <div
                  className={`p-2.5 rounded border transition-colors ${
                    hba1cVal !== baseHba1c
                      ? "border-[var(--accent-teal-border)] bg-teal-50/30 dark:bg-teal-950/30"
                      : "border-[var(--border-hairline)] bg-[var(--bg-surface)]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1 text-xs mb-1">
                    <label htmlFor="a1c-input" className="font-medium text-[var(--text-primary)]">
                      HbA1c
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        Base: {baseHba1c}%
                      </span>
                      <input
                        id="a1c-input"
                        type="number"
                        step={0.1}
                        min={4.0}
                        max={15.0}
                        value={hba1cVal}
                        onChange={(e) => {
                          setActivePresetId(null);
                          setHba1cVal(Number(e.target.value));
                        }}
                        className="w-14 px-1.5 py-0.5 text-xs font-mono font-bold text-right border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
                      />
                      <span className="text-xs text-[var(--text-muted)]">%</span>
                      {hba1cVal !== baseHba1c && (
                        <button
                          type="button"
                          onClick={() => {
                            setActivePresetId(null);
                            setHba1cVal(baseHba1c);
                          }}
                          className="text-[10px] text-[var(--accent-teal)] hover:underline ml-1"
                          title="Reset HbA1c"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    aria-label="HbA1c"
                    min={4.0}
                    max={15.0}
                    step={0.1}
                    value={hba1cVal}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setHba1cVal(Number(e.target.value));
                    }}
                    className="w-full accent-[var(--accent-teal)] cursor-pointer"
                  />
                  <div className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                    Cohort 99th: ~7.1%
                  </div>
                </div>
              </div>
            </div>

            {/* GROUP 3: TRAJECTORY TREND & CLINICAL PROFILE TOGGLES */}
            <div className="p-3.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>Trajectory Direction & Clinical Profile</span>
                </div>
                {/* Trend selector */}
                <div className="flex items-center gap-1 bg-[var(--bg-surface)] p-0.5 border border-[var(--border-hairline)] rounded">
                  {(["improving", "stable", "worsening"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setActivePresetId(null);
                        setTrend(t);
                      }}
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

              {/* Historical Trajectory Option Toggle */}
              <div className="p-2.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={modelHistoricalTrajectory}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setModelHistoricalTrajectory(e.target.checked);
                    }}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Model Hypothetical Historical Trajectory (Shift Intake Anchors)</span>
                </label>
                <p className="text-[10px] text-[var(--text-muted)] pl-5 leading-relaxed">
                  {modelHistoricalTrajectory
                    ? "Active: Historical intake features (e.g., baseline_sbp, sbp_first_365d) are shifted proportionately to simulate lifelong counterfactual status."
                    : "Default: Historical intake features remain fixed as immutable patient history. Only current measurements and moving averages are updated."}
                </p>
              </div>

              {/* Conditions & Medications Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <input
                    type="checkbox"
                    checked={conditions.htn_history === 1}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setConditions({ ...conditions, htn_history: e.target.checked ? 1 : 0 });
                    }}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Hypertension History</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <input
                    type="checkbox"
                    checked={conditions.diabetes_history === 1}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setConditions({ ...conditions, diabetes_history: e.target.checked ? 1 : 0 });
                    }}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Type 2 Diabetes History</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <input
                    type="checkbox"
                    checked={medications.antihypertensive_med_history === 1}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setMedications({
                        ...medications,
                        antihypertensive_med_history: e.target.checked ? 1 : 0,
                      });
                    }}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Antihypertensive Rx Adherent</span>
                </label>
                <label className="flex items-center gap-2 p-2 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] cursor-pointer text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
                  <input
                    type="checkbox"
                    checked={medications.statin_lipid_med_history === 1}
                    onChange={(e) => {
                      setActivePresetId(null);
                      setMedications({
                        ...medications,
                        statin_lipid_med_history: e.target.checked ? 1 : 0,
                      });
                    }}
                    className="accent-[var(--accent-teal)]"
                  />
                  <span>Statin / Lipid-Lowering Rx</span>
                </label>
              </div>
            </div>

            {/* GROUP 4: ADVANCED SEARCHABLE FEATURE TABLE */}
            <div className="border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between p-3 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                  <span>
                    Advanced Feature Inspector & Direct Overrides ({advancedCatalog.length} features)
                  </span>
                </span>
                {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="p-3 border-t border-[var(--border-hairline)] space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter features by name or clinical domain (e.g. encounters, bun, creatinine)..."
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
                          <th className="p-2">Training Range</th>
                          <th className="p-2 text-center">Baseline</th>
                          <th className="p-2 text-right">Scenario Value</th>
                          <th className="p-2 text-center w-14">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)]">
                        {advancedCatalog.map((item) => {
                          const rawVal = featureRow?.[item.name];
                          const isMissing = rawVal === undefined || rawVal === null;
                          const isCat = item.is_cat || typeof rawVal === "string";

                          let origDisplay: string;
                          let origNumericVal: number = item.plausible_min ?? item.min;

                          if (isMissing) {
                            origDisplay = "N/A";
                          } else if (isCat) {
                            const str = String(rawVal).trim();
                            if (item.name === "gender") {
                              origDisplay = str.toUpperCase().startsWith("M")
                                ? "Male"
                                : str.toUpperCase().startsWith("F")
                                ? "Female"
                                : str;
                            } else {
                              origDisplay = str ? str.charAt(0).toUpperCase() + str.slice(1) : "N/A";
                            }
                          } else {
                            const num = Number(rawVal);
                            if (isNaN(num)) {
                              origDisplay = "N/A";
                            } else {
                              origNumericVal = num;
                              origDisplay = Number.isInteger(num) ? num.toString() : num.toFixed(1);
                            }
                          }

                          const isEdited =
                            !isCat &&
                            customFeatures[item.name] !== undefined &&
                            customFeatures[item.name] !== origNumericVal;

                          const currentVal =
                            !isCat && customFeatures[item.name] !== undefined
                              ? customFeatures[item.name]
                              : origNumericVal;

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
                                {isCat ? "Categorical" : `[${item.min}, ${item.max}]`}
                              </td>
                              <td className="p-2 text-center text-[10px] font-mono text-[var(--text-secondary)]">
                                {origDisplay}
                              </td>
                              <td className="p-2 text-right">
                                {isCat ? (
                                  <span className="text-[10px] text-[var(--text-muted)] italic font-mono pr-2">
                                    Fixed demographic
                                  </span>
                                ) : (
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
                                )}
                              </td>
                              <td className="p-2 text-center">
                                {!isCat && isEdited && (
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

          {/* ── RIGHT 5 COLS: LIVE RESULTS, PROMINENT WARNINGS, SHAP, SENSITIVITY ──── */}
          <div className="lg:col-span-5 space-y-4">
            {/* LIVE SIMULATION RESULT COMPARISON */}
            {simulation && (
              <div className="p-4 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase font-bold text-[var(--text-muted)] flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                    <span>Scenario Comparison</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveScenario}
                    disabled={savedScenarios.length >= 3}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] disabled:opacity-40 transition-colors"
                  >
                    <Save className="w-3 h-3 text-[var(--accent-teal)]" />
                    <span>Save Scenario ({savedScenarios.length}/3)</span>
                  </button>
                </div>

                {/* ── PROMINENT OUT-OF-DISTRIBUTION WARNING ─────────────────────── */}
                {simulation.is_out_of_range && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-400 dark:border-amber-600 rounded-lg text-amber-950 dark:text-amber-100 text-xs space-y-2 shadow-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <div className="font-bold text-sm leading-tight text-amber-900 dark:text-amber-200">
                          Out-of-Distribution Exploratory Output
                        </div>
                        <p className="text-[11px] leading-relaxed mt-0.5 text-amber-800 dark:text-amber-300">
                          Hypothetical inputs exceed the model&rsquo;s documented 99th percentile training bounds. The resulting score represents an exploratory mathematical tree routing, <strong>not a reliable clinical risk reduction</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Specific features outside supported bounds */}
                    {simulation.out_of_range_features && simulation.out_of_range_features.length > 0 && (
                      <div className="bg-white/80 dark:bg-slate-900/80 rounded p-2 border border-amber-200 dark:border-amber-800 space-y-1">
                        <div className="text-[10px] font-mono uppercase font-bold text-amber-800 dark:text-amber-300">
                          Breached Training Bounds ({simulation.out_of_range_features.length}):
                        </div>
                        <div className="space-y-1">
                          {simulation.out_of_range_features.map((feat) => (
                            <div
                              key={feat.feature}
                              className="flex items-center justify-between text-[10px] font-mono border-b border-amber-100 dark:border-amber-900/40 pb-0.5 last:border-0 last:pb-0"
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {feat.label}:
                              </span>
                              <span className="text-rose-600 dark:text-rose-400 font-bold">
                                {feat.value} {feat.unit}
                              </span>
                              <span className="text-[9px] text-slate-500">
                                [99th: {feat.plausible_max != null ? `${feat.plausible_max} ${feat.unit}` : "N/A"}]
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] italic text-amber-800/80 dark:text-amber-300/80 leading-tight">
                      *Note: In synthetic cohorts, extreme lab values often trigger selection artifacts where tree leaves associate high z-scores with negative log-odds.
                    </div>
                  </div>
                )}

                {/* ── 2-COLUMN BASELINE VS SIMULATED SCORE CARDS ───────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Baseline Card */}
                  <div className="p-3 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-1">
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono font-semibold">
                      Baseline Risk
                    </span>
                    <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      {(simulation.baseline_risk * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className={RISK_BADGE_CLASSES[normalizeTier(simulation.baseline_tier)]}>
                        {simulation.baseline_tier} Risk
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono pt-1 border-t border-[var(--border-hairline)]">
                      Raw Margin: {simulation.baseline_raw.toFixed(4)}
                    </div>
                  </div>

                  {/* Scenario Card */}
                  <div
                    className={`p-3 bg-[var(--bg-surface)] rounded space-y-1 shadow-2xs border ${
                      simulation.is_out_of_range
                        ? "border-amber-400 dark:border-amber-600 bg-amber-50/10"
                        : "border-[var(--accent-teal-border)]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--accent-teal)] uppercase font-mono font-bold">
                        Simulated Risk
                      </span>
                      {simulation.is_out_of_range && (
                        <span className="text-[9px] px-1 bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 font-mono rounded">
                          Exploratory
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                      {(simulation.scenario_risk * 100).toFixed(1)}%
                    </div>
                    <div>
                      <span className={RISK_BADGE_CLASSES[normalizeTier(simulation.scenario_tier)]}>
                        {simulation.scenario_tier} Risk
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] font-mono pt-1 border-t border-[var(--border-hairline)]">
                      Raw Margin: {simulation.scenario_raw.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* ── ARITHMETIC DIFFERENCE & EXPLANATION ─────────────────────── */}
                <div className="p-2.5 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[var(--text-secondary)] font-medium">Absolute Shift:</span>
                    <span
                      className={`font-bold text-sm ${
                        simulation.is_out_of_range
                          ? "text-amber-700 dark:text-amber-300"
                          : simulation.delta_risk_pp < 0
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

                  {simulation.relative_change_pct != null && typeof simulation.relative_change_pct === "number" && (
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[var(--text-secondary)]">Relative Change:</span>
                      <span
                        className={`font-bold ${
                          simulation.is_out_of_range
                            ? "text-amber-700 dark:text-amber-300"
                            : simulation.relative_change_pct < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : simulation.relative_change_pct > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {simulation.relative_change_pct > 0 ? "+" : ""}
                        {simulation.relative_change_pct.toFixed(1)}%
                      </span>
                    </div>
                  )}

                  <div className="text-[10px] text-[var(--text-muted)] border-t border-[var(--border-hairline)] pt-1.5 leading-tight">
                    {simulation.is_out_of_range ? (
                      <span className="text-amber-800 dark:text-amber-300 font-medium">
                        ⚠️ Note: Because scenario inputs exceed training bounds, this absolute shift cannot be interpreted as a dependable clinical benefit.
                      </span>
                    ) : (
                      <span>
                        Absolute shift represents probability points (
                        {simulation.delta_risk_pp > 0 ? "+" : ""}
                        {simulation.delta_risk_pp.toFixed(2)} pp). Relative change represents proportional risk ratio (
                        {simulation.relative_change_pct != null && typeof simulation.relative_change_pct === "number"
                          ? `${simulation.relative_change_pct > 0 ? "+" : ""}${simulation.relative_change_pct.toFixed(1)}%`
                          : "N/A"}
                        ).
                      </span>
                    )}
                  </div>
                </div>

                {/* ── LOW SENSITIVITY NOTICE ─────────────────────────────────── */}
                {simulation.is_low_sensitivity && !simulation.is_out_of_range && (
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <strong className="font-bold">LOW_SENSITIVITY Notice:</strong>
                      <div className="text-[11px] leading-relaxed">
                        The model shows minimal score variance for this patient profile across the evaluated inputs.
                      </div>
                    </div>
                  </div>
                )}

                {/* ── WHAT DROVE THE CHANGE: SHAP IMPACT SHIFT ───────────────── */}
                {simulation.shap_diff && simulation.shap_diff.length > 0 && (
                  <div className="p-3 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                        <span>SHAP Attribution Shift</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-[var(--bg-subtle)] text-[var(--text-muted)] font-mono rounded border border-[var(--border-hairline)]">
                        Scale: Log-Odds Margin
                      </span>
                    </div>

                    <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                      Quantifies the change in internal XGBoost log-odds contributions (Scenario vs. Baseline). Negative attributions reflect tree routing, not clinical protection.
                    </p>

                    <div className="space-y-2">
                      {simulation.shap_diff.slice(0, 5).map((item) => (
                        <div key={item.feature} className="text-[11px] space-y-0.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[var(--text-primary)] font-medium truncate max-w-[210px]">
                              {item.human_name}
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-[10px]">
                              <span className="text-[var(--text-muted)]">
                                {item.attribution_before.toFixed(3)} → {item.attribution_after.toFixed(3)}
                              </span>
                              <span
                                className={`font-bold ${
                                  item.attribution_diff < 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : item.attribution_diff > 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-[var(--text-faint)]"
                                }`}
                              >
                                ({item.attribution_diff > 0 ? "+" : ""}
                                {item.attribution_diff.toFixed(4)})
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden flex">
                            {item.attribution_diff < 0 ? (
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.abs(item.attribution_diff) * 150)}%` }}
                              />
                            ) : (
                              <div
                                className="h-full bg-rose-500 rounded-full ml-auto"
                                style={{ width: `${Math.min(100, Math.abs(item.attribution_diff) * 150)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── CORRELATED FEATURE UPDATES & BREAKDOWN ─────────────────── */}
                {simulation.features_changed.length > 0 && (
                  <div className="p-3 bg-[var(--bg-surface)] rounded border border-[var(--border-hairline)] space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowCorrelatedDetails(!showCorrelatedDetails)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <span className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-[var(--accent-teal)]" />
                        <span>Correlated Model Features Shifted ({simulation.features_changed.length})</span>
                      </span>
                      {showCorrelatedDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {showCorrelatedDetails ? (
                      <div className="space-y-2 pt-1 border-t border-[var(--border-hairline)] text-xs">
                        <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                          The transformation pipeline preserves mathematical consistency across the 132-feature matrix by deriving dependent vitals and rolling window aggregates.
                        </p>
                        {simulation.dependent_features_summary && simulation.dependent_features_summary.length > 0 ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                            {simulation.dependent_features_summary.map((summaryItem) => (
                              <div
                                key={summaryItem.feature}
                                className="p-2 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-[10px] text-[var(--text-primary)]">
                                    {summaryItem.label} ({summaryItem.feature})
                                  </span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.2 bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-hairline)] font-mono rounded">
                                    {summaryItem.category.replace("_", " ")}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)]">
                                  <span>Before: {String(summaryItem.value_before ?? "N/A")}</span>
                                  <span>→ After: {String(summaryItem.value_after ?? "N/A")}</span>
                                </div>
                                <p className="text-[9px] text-[var(--text-muted)] leading-tight">
                                  {summaryItem.rationale}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
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
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[var(--text-muted)]">
                        Click to view dependent vital recalculations and rolling window updates.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── SENSITIVITY RESPONSE CURVES ───────────────────────────────── */}
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

                <div className="flex flex-wrap items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <span>
                    Evaluating: <strong className="text-[var(--text-primary)]">{activeCurve.display_name}</strong>
                  </span>
                  {activeCurve.supported_min !== undefined && activeCurve.supported_max !== undefined && (
                    <span className="font-mono text-[9px]">
                      Supported Range: [{activeCurve.supported_min}, {activeCurve.supported_max}] {activeCurve.unit}
                    </span>
                  )}
                </div>

                {/* SVG Curve Chart with Shaded Supported Band */}
                <div className="h-28 w-full bg-[var(--bg-subtle)] rounded p-2 border border-[var(--border-hairline)] relative flex items-end">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50" preserveAspectRatio="none">
                    {(() => {
                      const pts = activeCurve.points;
                      if (!pts || pts.length === 0) return null;
                      const minRisk = Math.min(...pts.map((p) => p.calibrated_risk));
                      const maxRisk = Math.max(...pts.map((p) => p.calibrated_risk)) || 0.01;

                      // Calculate X coordinates for supported bounds if present
                      const sMin = activeCurve.supported_min ?? pts[0].value;
                      const sMax = activeCurve.supported_max ?? pts[pts.length - 1].value;
                      const minVal = pts[0].value;
                      const maxVal = pts[pts.length - 1].value;
                      const range = maxVal - minVal || 1;

                      const suppX1 = Math.max(0, Math.min(100, ((sMin - minVal) / range) * 100));
                      const suppX2 = Math.max(0, Math.min(100, ((sMax - minVal) / range) * 100));

                      const path = pts
                        .map((p, idx) => {
                          const x = (idx / (pts.length - 1)) * 100;
                          const normY =
                            maxRisk === minRisk ? 25 : 45 - ((p.calibrated_risk - minRisk) / (maxRisk - minRisk)) * 38;
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
                      const currY =
                        maxRisk === minRisk
                          ? 25
                          : 45 - ((currPt.calibrated_risk - minRisk) / (maxRisk - minRisk)) * 38;

                      const isOut = activeCurve.is_current_out_of_range;

                      return (
                        <>
                          {/* Shaded Supported Distribution Band */}
                          <rect
                            x={suppX1}
                            y={0}
                            width={Math.max(0, suppX2 - suppX1)}
                            height={50}
                            fill="rgba(16, 185, 129, 0.08)"
                          />
                          <path
                            d={path}
                            fill="none"
                            stroke="var(--accent-teal)"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          {/* Current Value Indicator */}
                          <line
                            x1={currX}
                            y1={0}
                            x2={currX}
                            y2={50}
                            stroke={isOut ? "#f59e0b" : "#10b981"}
                            strokeWidth="1.5"
                            strokeDasharray="2,2"
                          />
                          <circle
                            cx={currX}
                            cy={currY}
                            r="3.5"
                            fill={isOut ? "#f59e0b" : "#10b981"}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="flex justify-between text-[9px] font-mono text-[var(--text-muted)]">
                  <span>
                    Min: {activeCurve.points[0]?.value} {activeCurve.unit}
                  </span>
                  <span
                    className={`font-bold ${
                      activeCurve.is_current_out_of_range
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    Current: {activeCurve.current_value} {activeCurve.unit}{" "}
                    {activeCurve.is_current_out_of_range && "(Out of Distribution)"}
                  </span>
                  <span>
                    Max: {activeCurve.points[activeCurve.points.length - 1]?.value} {activeCurve.unit}
                  </span>
                </div>
              </div>
            )}

            {/* MANDATORY RESEARCH DISCLAIMER */}
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Clinical Model Notice:</strong> Demonstrates internal score sensitivity of the trained model on synthetic EHR data. It does not predict real treatment response and does not replace certified clinical judgment.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

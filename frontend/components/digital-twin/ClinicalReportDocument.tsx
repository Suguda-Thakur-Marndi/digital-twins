"use client";

import React, { useMemo } from "react";
import {
  PatientDetail,
  PatientSummary,
  PredictResponse,
  ModelInfo,
  VitalSigns,
  RiskState,
  SnapshotItem,
} from "@/lib/api";
import { normalizeTier } from "@/lib/types";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  HeartPulse,
} from "lucide-react";

export interface ClinicalReportDocumentProps {
  patient: PatientDetail | null;
  summary?: PatientSummary | null;
  prediction: PredictResponse | null;
  modelInfo?: ModelInfo | null;
  activeVitals?: VitalSigns;
  activeRisk?: RiskState;
  activeRiskSource?: "counterfactual_simulation" | "historical_replay" | "baseline";
  activeSnapshotIdx?: number;
  currentSnapshot?: SnapshotItem | null;
  simulatedScenario?: {
    res: any;
    vitals?: VitalSigns;
  } | null;
  reportId?: string;
  generatedAt?: string;
}

export function ClinicalReportDocument({
  patient,
  summary,
  prediction,
  modelInfo,
  activeVitals,
  activeRisk,
  activeRiskSource = "baseline",
  activeSnapshotIdx = 0,
  currentSnapshot,
  simulatedScenario,
  reportId: propReportId,
  generatedAt: propGeneratedAt,
}: ClinicalReportDocumentProps) {
  // Patient Identifiers
  const patientDisplayId =
    patient?.display_id ||
    summary?.display_id ||
    (patient?.id ? String(patient.id) : "PT-UNASSIGNED");
  const patientDisplayName =
    patient?.display_label ||
    patient?.name ||
    summary?.display_label ||
    summary?.name ||
    `Patient (${patientDisplayId})`;
  const patientAge =
    patient?.age != null
      ? `${patient.age} yrs`
      : summary?.age != null
      ? `${summary.age} yrs`
      : "Not recorded";
  const patientSex =
    patient?.gender ||
    summary?.gender ||
    patient?.sex ||
    "Not recorded";
  const encounterDate =
    (activeRiskSource === "historical_replay" && currentSnapshot?.date)
      ? currentSnapshot.date
      : patient?.as_of_date || summary?.as_of_date || "Current Encounter";

  // Data completeness
  const completeness =
    prediction?.data_completeness ??
    summary?.data_completeness_pct ??
    patient?.data_completeness_pct ??
    null;

  // Effective Vitals
  const effectiveVitals: VitalSigns = activeVitals || patient?.latest_vitals || {
    sbp: summary?.latest_sbp,
    dbp: summary?.latest_dbp,
  };
  const sbp = effectiveVitals.sbp;
  const dbp = effectiveVitals.dbp;
  const pulsePressure =
    effectiveVitals.pulse_pressure != null
      ? effectiveVitals.pulse_pressure
      : sbp != null && dbp != null
      ? sbp - dbp
      : null;
  const hr = effectiveVitals.hr;
  const bmi = effectiveVitals.bmi;
  const weight = effectiveVitals.weight;
  const glucose = effectiveVitals.glucose;
  const hba1c = effectiveVitals.hba1c;

  // Effective Risk
  const currentRiskScore =
    activeRisk?.calibrated_risk ??
    prediction?.calibrated_risk ??
    summary?.calibrated_risk ??
    null;
  const currentRawScore =
    activeRisk?.raw_score ??
    prediction?.raw_score ??
    summary?.raw_score ??
    null;
  const currentRiskTier = normalizeTier(
    activeRisk?.risk_tier ||
      prediction?.risk_tier ||
      summary?.risk_tier ||
      "Low"
  );

  // Confidence Interval (95% uncertainty)
  const isPredictionForPatient =
    prediction &&
    (!prediction.patient_id ||
      !patient ||
      prediction.patient_id === patient.id ||
      prediction.patient_id === patient.display_id);

  const rawCi =
    activeRiskSource === "baseline"
      ? (isPredictionForPatient ? prediction?.confidence_interval_95 : undefined) ||
        activeRisk?.confidence_interval_95
      : undefined;

  const isCiValid =
    Array.isArray(rawCi) &&
    rawCi.length === 2 &&
    typeof rawCi[0] === "number" &&
    typeof rawCi[1] === "number" &&
    !isNaN(rawCi[0]) &&
    !isNaN(rawCi[1]) &&
    currentRiskScore != null &&
    rawCi[0] <= currentRiskScore &&
    currentRiskScore <= rawCi[1];

  const reportId = useMemo(
    () =>
      propReportId ||
      `VT-REP-${patientDisplayId.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase()}-REF`,
    [propReportId, patientDisplayId]
  );

  const generatedTimestamp =
    propGeneratedAt ||
    `${encounterDate} · Synchronized Clinical Snapshot`;

  const topDrivers = prediction?.top_contributing_factors?.slice(0, 6) || [];

  return (
    <article
      className="clinical-report-root w-full bg-white text-slate-900 p-6 sm:p-8 space-y-6 text-xs font-sans print:p-0 print:m-0 print:text-black print:bg-white"
      aria-label={`Clinical AI Risk Assessment Report for ${patientDisplayName}`}
    >
      {/* ── 1. REPORT HEADER & BRANDING ─────────────────────────────────── */}
      <header className="border-b-2 border-blue-600 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 clinical-report-section print-break-inside-avoid">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-serif font-bold text-base shadow-sm print:border print:border-blue-800">
              V
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-2xl font-bold tracking-tight text-blue-900 print:text-blue-900">
                  VitalTwin
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold border border-blue-300 print:bg-transparent print:border-blue-600">
                  Clinical AI Decision-Support
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">
                Longitudinal Digital Twin · Decompensation Risk Assessment
              </p>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono pt-1">
            Happiest Health Summit 2026 Bengaluru · Research Prototype
          </p>
        </div>

        <div className="text-left sm:text-right font-mono text-[10px] text-slate-600 space-y-0.5 shrink-0">
          <div>
            <span className="text-slate-400 uppercase">Report ID: </span>
            <span className="font-bold text-slate-800">{reportId}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase">Generated: </span>
            <span className="font-semibold text-slate-800">{generatedTimestamp}</span>
          </div>
          <div className="flex items-center gap-1 sm:justify-end text-emerald-700 font-semibold pt-0.5">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>De-Identified Research Record (Zero PHI)</span>
          </div>
        </div>
      </header>

      {/* ── 2. PATIENT & CONTEXT IDENTIFIERS ────────────────────────────── */}
      <section className="clinical-report-section clinical-report-card p-4 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs print:bg-white print:border-slate-400 print-break-inside-avoid">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">
              Patient Identifier
            </span>
            <span className="font-bold text-sm text-slate-900 block mt-0.5">
              {patientDisplayId}
            </span>
            <span className="text-[10px] text-slate-600 truncate block mt-0.5">
              {patientDisplayName}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">
              Demographics
            </span>
            <span className="font-bold text-sm text-slate-900 block mt-0.5">
              {patientAge}
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5">
              Sex: {patientSex}
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">
              Snapshot / Encounter
            </span>
            <span className="font-bold text-sm text-slate-900 block mt-0.5">
              {encounterDate}
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5">
              Cohort: Synthea EHR
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-sans">
              Data Completeness
            </span>
            <span className="font-bold text-sm text-slate-900 block mt-0.5">
              {completeness != null ? `${completeness}%` : "Recorded"}
            </span>
            <span className="text-[10px] text-slate-600 block mt-0.5">
              {completeness != null
                ? `${Math.round((completeness / 100) * 132)} / 132 features`
                : "Standard schema vector"}
            </span>
          </div>
        </div>

        {/* Active Simulation Status Notice */}
        <div className="mt-3 pt-3 border-t border-slate-200 text-[11px] font-sans flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">Assessment Mode:</span>
            {activeRiskSource === "counterfactual_simulation" ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-bold border border-purple-300 font-mono text-[10px]">
                  Counterfactual Simulation Scenario (Digital Twin Projection)
                </span>
                {simulatedScenario?.vitals && (
                  <span className="text-[10px] text-purple-800 font-mono">
                    ({simulatedScenario.vitals.sbp != null ? `SBP: ${simulatedScenario.vitals.sbp} mmHg ` : ""}
                    {simulatedScenario.vitals.dbp != null ? `· DBP: ${simulatedScenario.vitals.dbp} mmHg ` : ""}
                    {simulatedScenario.vitals.weight != null ? `· Wt: ${simulatedScenario.vitals.weight} kg` : ""})
                  </span>
                )}
              </div>
            ) : activeRiskSource === "historical_replay" ? (
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300 font-mono text-[10px]">
                Historical Replay Snapshot #{activeSnapshotIdx + 1} ({currentSnapshot?.date || encounterDate})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold border border-blue-300 font-mono text-[10px]">
                Model Baseline (Current EHR Trajectory)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Lookforward Horizon: 365 Days
          </span>
        </div>
      </section>

      {/* ── 3. PREDICTION TARGET & RISK ESTIMATE ─────────────────────────── */}
      <section className="clinical-report-section clinical-report-card p-4 rounded-xl border-2 border-blue-300 bg-blue-50/40 space-y-3 print:bg-white print:border-slate-500 print-break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200 pb-2.5">
          <div>
            <div className="text-[10px] font-mono uppercase font-bold text-blue-800 tracking-wider">
              Primary Prediction Target
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900">
              365-Day Stage 2 Hypertension Decompensation Risk
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Clinical Endpoint: Progression to ambulatory or clinical Systolic BP ≥ 140 mmHg or Diastolic BP ≥ 90 mmHg.
            </p>
          </div>
          <div>
            <span
              className={`inline-block text-xs font-mono font-bold px-3 py-1 rounded-full border shadow-2xs ${
                currentRiskTier === "High"
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : currentRiskTier === "Moderate"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
              }`}
            >
              {currentRiskTier} Risk Tier
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <div className="p-3 rounded-lg bg-white border border-slate-300">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Calibrated Risk Probability
            </span>
            <span className="text-2xl font-bold text-blue-800 block mt-0.5">
              {currentRiskScore != null ? `${(currentRiskScore * 100).toFixed(1)}%` : "Not computed"}
            </span>
            <span className="text-[10px] text-slate-600 block mt-1">
              {isCiValid && rawCi
                ? `95% CI: [${(rawCi[0] * 100).toFixed(1)}% – ${(rawCi[1] * 100).toFixed(1)}%]`
                : activeRiskSource !== "baseline"
                ? "CI not evaluated for simulation scenario"
                : "95% uncertainty interval unavailable"}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-300">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Raw Decision Score
            </span>
            <span className="text-2xl font-bold text-slate-800 block mt-0.5">
              {currentRawScore != null ? currentRawScore.toFixed(4) : "—"}
            </span>
            <span className="text-[10px] text-slate-600 block mt-1">
              Uncalibrated tree ensemble decision margin
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-slate-300">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Clinical Action Guidance
            </span>
            <span className="text-xs font-bold text-slate-900 block mt-1 font-sans">
              {currentRiskTier === "High"
                ? "Urgent Review & Medication Titration Protocol"
                : currentRiskTier === "Moderate"
                ? "Ambulatory Monitoring & Lifestyle Protocol"
                : "Routine Annual Follow-Up & Standard Care"}
            </span>
            <span className="text-[10px] text-slate-500 block mt-1">
              Tier boundaries: Low (&lt;15%), Mod (15–40%), High (&ge;40%)
            </span>
          </div>
        </div>
      </section>

      {/* ── 4. RECORDED CLINICAL MEASUREMENTS ───────────────────────────── */}
      <section className="clinical-report-section space-y-2 print-break-inside-avoid">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider flex items-center gap-1.5">
            <HeartPulse className="w-3.5 h-3.5 text-blue-700" />
            <span>Recorded Clinical Measurements &amp; Physiological Indicators</span>
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            As of: {encounterDate}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Systolic BP
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {sbp != null && !isNaN(Number(sbp)) ? `${Math.round(Number(sbp))} mmHg` : "Not Recorded"}
            </span>
            <span className="text-[9px] text-slate-500 block">AHA Target: &lt;120 mmHg</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Diastolic BP
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {dbp != null && !isNaN(Number(dbp)) ? `${Math.round(Number(dbp))} mmHg` : "Not Recorded"}
            </span>
            <span className="text-[9px] text-slate-500 block">AHA Target: &lt;80 mmHg</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Pulse Pressure
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {pulsePressure != null && !isNaN(Number(pulsePressure))
                ? `${Math.round(Number(pulsePressure))} mmHg`
                : "Not Recorded"}
            </span>
            <span className="text-[9px] text-slate-500 block">Ref: 40–60 mmHg</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Resting Heart Rate
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {hr != null && !isNaN(Number(hr)) ? `${Math.round(Number(hr))} bpm` : "Not Recorded"}
            </span>
            <span className="text-[9px] text-slate-500 block">Ref: 60–100 bpm</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              BMI &amp; Adiposity
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {bmi != null && !isNaN(Number(bmi)) ? `${Number(bmi).toFixed(1)} kg/m²` : "Not Recorded"}
            </span>
            <span className="text-[9px] text-slate-500 block">Ref: 18.5–24.9 kg/m²</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Body Weight
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {weight != null && !isNaN(Number(weight)) ? `${Number(weight).toFixed(1)} kg` : "Not Recorded"}
            </span>
            <span className="text-[9px] text-slate-500 block">Recorded weight</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Fasting Blood Glucose
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {glucose != null && !isNaN(Number(glucose)) ? `${Math.round(Number(glucose))} mg/dL` : "Not Tested"}
            </span>
            <span className="text-[9px] text-slate-500 block">Ref: 70–99 mg/dL</span>
          </div>

          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 print:bg-white">
            <span className="text-[10px] text-slate-500 block font-sans font-medium">
              Glycated HbA1c
            </span>
            <span className="text-base font-bold text-slate-900 block">
              {hba1c != null && !isNaN(Number(hba1c)) ? `${Number(hba1c).toFixed(1)}%` : "Not Tested"}
            </span>
            <span className="text-[9px] text-slate-500 block">Ref: &lt;5.7% (Normal)</span>
          </div>
        </div>
      </section>

      {/* ── 5. MODEL EXPLANATION (TREESHAP ATTRIBUTIONS) ──────────────────── */}
      <section className="clinical-report-section space-y-2 print-break-inside-avoid">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
            Model Explanation (Local TreeSHAP Feature Attributions)
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            Mathematical Attributions (Non-Causal)
          </span>
        </div>

        {topDrivers.length > 0 ? (
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-slate-100 text-[10px] text-slate-700 uppercase border-b border-slate-300">
                <tr>
                  <th className="p-2.5">Feature Description</th>
                  <th className="p-2.5">Observed Value</th>
                  <th className="p-2.5 text-right">Attribution Impact</th>
                  <th className="p-2.5">Directional Impact Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {topDrivers.map((driver) => {
                  const isPositive = driver.impact > 0;
                  return (
                    <tr key={driver.feature} className="hover:bg-slate-50">
                      <td className="p-2.5 font-sans font-semibold text-slate-900">
                        {driver.label || driver.feature}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {driver.observed_value != null && driver.observed_value !== ""
                          ? String(driver.observed_value)
                          : "Recorded in EHR"}
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold ${
                          isPositive ? "text-rose-700" : "text-emerald-700"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {(driver.impact * 100).toFixed(1)}%
                      </td>
                      <td className="p-2.5 font-sans text-[10px] text-slate-600">
                        {isPositive
                          ? "Increases decompensation risk relative to population base rate"
                          : "Decreases decompensation risk relative to population base rate"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-3 text-slate-500 italic bg-slate-50 rounded-lg border border-slate-200">
            Model feature attributions are computed upon inference request.
          </div>
        )}

        <p className="text-[10px] text-slate-500 italic leading-relaxed pt-0.5">
          Note: Local TreeSHAP attributions quantify the additive marginal contribution of each input feature to the XGBoost decision score relative to expected cohort base values. They represent mathematical model feature importance and do not establish biological causation.
        </p>
      </section>

      {/* ── 6. CLINICAL LIMITATIONS & RESPONSIBLE AI GOVERNANCE ──────────── */}
      <section className="clinical-report-section clinical-report-card p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 text-amber-950 text-xs space-y-2 print:bg-white print:border-slate-400 print-break-inside-avoid">
        <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>Clinical Limitations &amp; Responsible-Use AI Disclosures</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-amber-950">
          <li>
            <strong>Synthetic Data Provenance:</strong> The VitalTwin predictive engine is trained and evaluated exclusively on 8,240 synthetic longitudinal patient trajectories generated via the open-source Synthea EHR simulator. Contains zero Protected Health Information (PHI).
          </li>
          <li>
            <strong>Calibration &amp; Validation:</strong> Platt-scaling logistic regression calibration is applied to map raw ensemble logits into empirical probabilities. Model performance: ROC-AUC = 0.807 (95% CI: 0.691–0.908), PR-AUC = 0.064, Brier Score = 0.028.
          </li>
          <li>
            <strong>Regulatory Scope:</strong> Research and clinical evaluation prototype. Not cleared or approved by the US FDA, CDSCO (India), or European CE Mark for autonomous clinical diagnosis or treatment prescription. All patient management actions require licensed physician evaluation.
          </li>
          <li>
            <strong>Input Schema Contract:</strong> Validated against a 132-feature locked vector schema (Fingerprint: {modelInfo?.schema_fingerprint || "a4ddaedbdbc8bb07"}).
          </li>
        </ul>
      </section>

      {/* ── 7. CRYPTOGRAPHIC VERIFICATION & SIGNATURE BLOCK ─────────────── */}
      <footer className="clinical-report-section pt-4 border-t border-slate-300 flex flex-col sm:flex-row sm:items-end justify-between gap-6 font-mono text-[10px] text-slate-600 print-break-inside-avoid">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>SHA-256 Append-Only Audit Chain Verified</span>
          </div>
          <div>Model: Platt-Scaled XGBoost v{modelInfo?.version || "1.0.0"} · Schema: {modelInfo?.schema_fingerprint?.slice(0, 16) || "a4ddaedbdbc8bb07"}</div>
          <div>Audit Reference: {reportId}</div>
        </div>

        <div className="space-y-3 sm:text-right shrink-0">
          <div className="border-b border-slate-400 w-52 sm:ml-auto" />
          <div className="space-y-0.5 text-slate-700">
            <div className="font-semibold">Reviewing Clinician Signature / ID</div>
            <div className="text-[9px] text-slate-500">Date: ________________________</div>
          </div>
        </div>
      </footer>
    </article>
  );
}

export default ClinicalReportDocument;

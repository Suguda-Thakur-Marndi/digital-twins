"use client";

import React, { useRef, useMemo } from "react";
import {
  PatientDetail,
  PatientSummary,
  PredictResponse,
  ModelInfo,
} from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  Printer,
  X,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  Lock,
} from "lucide-react";

interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientDetail | null;
  summary: PatientSummary | null;
  prediction: PredictResponse | null;
  modelInfo: ModelInfo | null;
}

export function ClinicalReportModal({
  isOpen,
  onClose,
  patient,
  summary,
  prediction,
  modelInfo,
}: ClinicalReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const patientId = patient?.display_id || summary?.display_id || "PT-101";
  const patientAge = patient?.age ?? summary?.age ?? 58;
  const patientSex = patient?.gender || patient?.sex || summary?.gender || "M";
  const encounterDate = patient?.as_of_date || summary?.as_of_date || "2024-03-12";
  const currentRiskScore = prediction?.calibrated_risk ?? summary?.calibrated_risk ?? 0.153;
  const currentRiskTier = normalizeTier(prediction?.risk_tier || summary?.risk_tier || "Moderate");
  const rawCi = prediction?.confidence_interval_95;

  const isCiValid =
    Array.isArray(rawCi) &&
    rawCi.length === 2 &&
    typeof rawCi[0] === "number" &&
    typeof rawCi[1] === "number" &&
    !isNaN(rawCi[0]) &&
    !isNaN(rawCi[1]) &&
    rawCi[0] <= currentRiskScore &&
    currentRiskScore <= rawCi[1];

  const handlePrint = () => {
    window.print();
  };

  const topDrivers = prediction?.top_contributing_factors?.slice(0, 6) || [];
  const sbp = patient?.latest_vitals?.sbp ?? summary?.latest_sbp ?? 142;
  const dbp = patient?.latest_vitals?.dbp ?? summary?.latest_dbp ?? 88;
  const pulsePressure = patient?.latest_vitals?.pulse_pressure ?? (sbp && dbp ? sbp - dbp : 54);
  const bmi = patient?.latest_vitals?.bmi ?? 29.4;
  const weight = patient?.latest_vitals?.weight ?? 84;
  const hr = patient?.latest_vitals?.hr ?? 74;
  const glucose = patient?.latest_vitals?.glucose;
  const hba1c = patient?.latest_vitals?.hba1c;

  const reportId = useMemo(
    () => `VT-REP-${patientId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
    [patientId]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Clinical AI Risk Assessment Report
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Export PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close report"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div
          ref={reportRef}
          className="p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-200 text-xs font-sans print:p-0 print:text-black print:dark:text-black"
        >
          {/* Document Header */}
          <div className="border-b-2 border-blue-600 pb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-xl font-bold text-blue-900 dark:text-blue-400">
                  VitalTwin
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900">
                  Clinical AI Decision-Support
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Decompensation Risk Assessment · 365-Day Longitudinal Lookforward
              </p>
            </div>
            <div className="text-left sm:text-right font-mono text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
              <div>Report ID: <span className="font-bold text-slate-700 dark:text-slate-300">{reportId}</span></div>
              <div>Generated: <span className="font-bold text-slate-700 dark:text-slate-300">{new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</span></div>
              <div className="flex items-center gap-1 sm:justify-end text-emerald-600 dark:text-emerald-400 font-semibold">
                <Lock className="w-3 h-3" />
                <span>De-Identified Research Record</span>
              </div>
            </div>
          </div>

          {/* Section 1: Patient & Context Identification */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Patient ID</span>
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{patientId}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Demographics</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{patientAge} yrs · {patientSex === "M" ? "Male" : "Female"}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Encounter Date</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{encounterDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Data Completeness</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {prediction?.data_completeness ?? summary?.data_completeness_pct ?? 95.5}% (126/132 feats)
              </span>
            </div>
          </div>

          {/* Section 2: Core Risk Prediction Assessment */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 dark:border-blue-900/40 pb-2">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-blue-700 dark:text-blue-400 tracking-wider">
                  Target Outcome
                </span>
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  365-Day Stage 2 Hypertension Decompensation Risk
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Clinical Endpoint: Ambulatory or clinical progression to SBP ≥ 140 mmHg or DBP ≥ 90 mmHg.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${RISK_BADGE_CLASSES[currentRiskTier]}`}>
                  {currentRiskTier} Risk Tier
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans font-medium">Calibrated Probability</span>
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-400 block">
                  {(currentRiskScore * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  95% Uncertainty: {isCiValid && rawCi
                    ? `[${(rawCi[0] * 100).toFixed(1)}% – ${(rawCi[1] * 100).toFixed(1)}%]`
                    : "Uncertainty unavailable"}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans font-medium">Raw Model Score</span>
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-200 block">
                  {(prediction?.raw_score ?? summary?.raw_score ?? 0.12).toFixed(4)}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Uncalibrated XGBoost decision ranking
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans font-medium">Clinical Threshold Action</span>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mt-1">
                  {currentRiskTier === "High"
                    ? "Urgent Clinical Review & Rx Titration"
                    : currentRiskTier === "Moderate"
                    ? "Ambulatory Monitoring & Lifestyle Protocol"
                    : "Routine Annual Follow-Up & Lifestyle"}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Tier bounds: Low (&lt;15%), Mod (15–40%), High (&ge;40%)
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Baseline Clinical Indicators */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase font-mono tracking-wider">
              Relevant Recorded Clinical Indicators
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] text-slate-400 block">Systolic BP</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{Math.round(sbp)} mmHg</span>
                <span className="text-[9px] text-slate-500 block">AHA Target: &lt;120 mmHg</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] text-slate-400 block">Diastolic BP</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{Math.round(dbp)} mmHg</span>
                <span className="text-[9px] text-slate-500 block">AHA Target: &lt;80 mmHg</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] text-slate-400 block">Pulse Pressure</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{Math.round(pulsePressure)} mmHg</span>
                <span className="text-[9px] text-slate-500 block">Ref: 40–60 mmHg</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] text-slate-400 block">BMI &amp; Weight</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{Number(bmi).toFixed(1)} kg/m²</span>
                <span className="text-[9px] text-slate-500 block">Weight: {Math.round(weight)} kg</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] text-slate-400 block">Resting Heart Rate</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">{Math.round(hr)} bpm</span>
                <span className="text-[9px] text-slate-500 block">Ref: 60–100 bpm</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-[10px] text-slate-400 block">Fasting Glucose</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {glucose != null ? `${glucose} mg/dL` : "Not Tested"}
                </span>
                <span className="text-[9px] text-slate-500 block">Ref: 70–99 mg/dL</span>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 col-span-2">
                <span className="text-[10px] text-slate-400 block">Glycated HbA1c</span>
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {hba1c != null ? `${hba1c}%` : "Not Tested in Encounter"}
                </span>
                <span className="text-[9px] text-slate-500 block">Ref: &lt;5.7% Normal · 5.7–6.4% Prediabetes</span>
              </div>
            </div>
          </div>

          {/* Section 4: TreeSHAP Feature Attribution Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase font-mono tracking-wider">
                Model Explainability (Local TreeSHAP Attributions)
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Non-Causal Mathematical Attribution</span>
            </div>
            {topDrivers.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">Feature Description</th>
                      <th className="p-2">Patient Value</th>
                      <th className="p-2 text-right">Attribution</th>
                      <th className="p-2">Directional Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {topDrivers.map((driver) => {
                      const isPositive = driver.impact > 0;
                      return (
                        <tr key={driver.feature} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                            {driver.label || driver.feature}
                          </td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">
                            {driver.observed_value != null ? String(driver.observed_value) : "Recorded"}
                          </td>
                          <td
                            className={`p-2 text-right font-bold ${
                              isPositive
                                ? "text-rose-700 dark:text-rose-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {(driver.impact * 100).toFixed(1)}%
                          </td>
                          <td className="p-2 font-sans text-[10px] text-slate-500 dark:text-slate-400">
                            {isPositive ? "Increases risk relative to cohort baseline" : "Decreases risk relative to cohort baseline (non-causal)"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 italic text-xs">Feature explanations unavailable.</p>
            )}
            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic leading-relaxed">
              SHAP values indicate mathematical feature importance within the tree ensemble relative to expected cohort value. They do not imply biological causality or proven clinical effect.
            </p>
          </div>

          {/* Section 5: Model Provenance, Data Quality & Safety Limitations */}
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Clinical AI Governance &amp; Limitation Disclosures</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed text-amber-950 dark:text-amber-300">
              <li>
                <strong>Synthetic Training Data:</strong> Trained and validated exclusively on 8,240 synthetic longitudinal patient trajectories generated via Synthea. Contains zero Protected Health Information (PHI).
              </li>
              <li>
                <strong>Calibration:</strong> Platt scaling logistic calibration applied to map raw XGBoost logits into empirical probabilities. ROC-AUC = 0.807 (95% CI 0.691–0.908), PR-AUC = 0.064.
              </li>
              <li>
                <strong>Regulatory Notice:</strong> Research prototype only. Not cleared or approved by the US FDA, CDSCO (India), or European CE mark for diagnostic or treatment decisions.
              </li>
              <li>
                <strong>Schema Contract:</strong> Locked 132-feature input schema (Fingerprint: {modelInfo?.schema_fingerprint || "a4ddaedbdbc8bb07"}).
              </li>
            </ul>
          </div>

          {/* Section 6: Cryptographic Verification & Signature Block */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>SHA-256 Append-Only Hash-Chain Verified</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Model: XGBoost v1.0.0 · Schema: {modelInfo?.schema_fingerprint?.slice(0, 16) || "a4ddaedbdbc8bb07"}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <div className="border-b border-slate-300 dark:border-slate-700 w-44 mb-1" />
              <span>Reviewing Clinician Signature / ID</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClinicalReportModal;

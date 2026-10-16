"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  registerPatient,
  PatientRegisterRequest,
  ApiError,
} from "@/lib/api";
import {
  User,
  HeartPulse,
  Pill,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Save,
  RotateCcw,
  ShieldAlert,
  Info,
  Activity,
  FileCheck,
} from "lucide-react";

interface FormState {
  // Step 1: Basics
  alias: string;
  age: number | "";
  gender: string;
  race: string;
  ethnicity: string;
  height_cm: number | "";
  weight_kg: number | "";
  
  // Step 2: Vitals & Labs
  sbp: number | "";
  dbp: number | "";
  heart_rate: number | "";
  glucose: number | "";
  hba1c: number | "";

  // Step 3: Meds & History
  med_antihypertensive: boolean;
  med_antidiabetic: boolean;
  med_statin: boolean;
  cond_hypertension: boolean;
  cond_diabetes: boolean;
  cond_cvd: boolean;
  cond_ckd: boolean;
  smoking: boolean;
  family_history: boolean;
  salt_intake: string;
  physical_activity: string;

  // Step 4: Consent
  consent_confirmed: boolean;
}

const INITIAL_FORM: FormState = {
  alias: "Synthetic Patient Case",
  age: 56,
  gender: "Female",
  race: "other",
  ethnicity: "non-hispanic",
  height_cm: 162,
  weight_kg: 68,

  sbp: 138,
  dbp: 86,
  heart_rate: 72,
  glucose: 104,
  hba1c: 5.8,

  med_antihypertensive: true,
  med_antidiabetic: false,
  med_statin: false,
  cond_hypertension: true,
  cond_diabetes: false,
  cond_cvd: false,
  cond_ckd: false,
  smoking: false,
  family_history: true,
  salt_intake: "normal",
  physical_activity: "moderate",

  consent_confirmed: false,
};

const DRAFT_KEY = "twincare_registration_draft_v1";

export default function RegisterPatientPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);

  // Restore draft on mount if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed, consent_confirmed: false }));
        setDraftSavedMsg("Loaded saved draft from browser storage.");
        setTimeout(() => setDraftSavedMsg(null), 4000);
      }
    } catch {
      // ignore
    }
  }, []);

  // Compute live BMI
  const computedBmi = useMemo(() => {
    if (form.height_cm && form.weight_kg && form.height_cm > 0) {
      const hM = Number(form.height_cm) / 100;
      return Math.round((Number(form.weight_kg) / (hM * hM)) * 10) / 10;
    }
    return null;
  }, [form.height_cm, form.weight_kg]);

  // Compute estimated feature completeness
  const estimatedCompleteness = useMemo(() => {
    let populatedCount = 45; // baseline demographic & one-hot derivations
    if (form.sbp) populatedCount += 12;
    if (form.dbp) populatedCount += 12;
    if (form.heart_rate) populatedCount += 8;
    if (form.weight_kg) populatedCount += 6;
    if (computedBmi) populatedCount += 6;
    if (form.glucose) populatedCount += 4;
    if (form.hba1c) populatedCount += 4;
    if (form.med_antihypertensive) populatedCount += 2;
    if (form.cond_hypertension) populatedCount += 2;
    // Cap at typical single-visit completeness (~62-68%) since 12m trend features are unobserved
    const pct = Math.min(68, Math.round((populatedCount / 132) * 100));
    return pct;
  }, [form, computedBmi]);

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      setDraftSavedMsg("Draft successfully saved to browser local storage.");
      setTimeout(() => setDraftSavedMsg(null), 3000);
    } catch {
      setDraftSavedMsg("Unable to save draft (local storage full or disabled).");
    }
  };

  const resetForm = () => {
    if (window.confirm("Reset all fields to defaults? Current inputs will be discarded.")) {
      setForm(INITIAL_FORM);
      setFieldErrors({});
      setGlobalError(null);
      localStorage.removeItem(DRAFT_KEY);
      setCurrentStep(1);
    }
  };

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.age || Number(form.age) < 18 || Number(form.age) > 115) {
      errs.age = "Age must be between 18 and 115 years.";
    }
    if (form.height_cm && (Number(form.height_cm) < 80 || Number(form.height_cm) > 250)) {
      errs.height_cm = "Height must be between 80 and 250 cm.";
    }
    if (form.weight_kg && (Number(form.weight_kg) < 25 || Number(form.weight_kg) > 300)) {
      errs.weight_kg = "Weight must be between 25 and 300 kg.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.sbp || Number(form.sbp) < 60 || Number(form.sbp) > 260) {
      errs.sbp = "Systolic BP must be between 60 and 260 mmHg.";
    }
    if (!form.dbp || Number(form.dbp) < 35 || Number(form.dbp) > 160) {
      errs.dbp = "Diastolic BP must be between 35 and 160 mmHg.";
    }
    if (form.sbp && form.dbp && Number(form.dbp) >= Number(form.sbp)) {
      errs.dbp = `Diastolic BP (${form.dbp}) must be strictly lower than Systolic BP (${form.sbp}).`;
    }
    if (form.heart_rate && (Number(form.heart_rate) < 30 || Number(form.heart_rate) > 220)) {
      errs.heart_rate = "Heart rate must be between 30 and 220 bpm.";
    }
    if (form.glucose && (Number(form.glucose) < 40 || Number(form.glucose) > 500)) {
      errs.glucose = "Blood glucose must be between 40 and 500 mg/dL.";
    }
    if (form.hba1c && (Number(form.hba1c) < 3.5 || Number(form.hba1c) > 18.0)) {
      errs.hba1c = "HbA1c must be between 3.5% and 18.0%.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    setGlobalError(null);
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handlePrev = () => {
    setGlobalError(null);
    setFieldErrors({});
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent_confirmed) {
      setGlobalError("Please confirm the synthetic test data and privacy acknowledgment checkbox.");
      return;
    }
    if (!validateStep1() || !validateStep2()) {
      setGlobalError("Please correct highlighted physiological validation errors before submitting.");
      return;
    }

    setSubmitting(true);
    setGlobalError(null);
    setFieldErrors({});

    const payload: PatientRegisterRequest = {
      display_name: form.alias.trim() || "Synthetic Demo Profile",
      alias: form.alias.trim() || "Synthetic Demo Profile",
      age: Number(form.age),
      gender: form.gender,
      race: form.race,
      ethnicity: form.ethnicity,
      height_cm: form.height_cm ? Number(form.height_cm) : undefined,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
      bmi: computedBmi || undefined,
      sbp: Number(form.sbp),
      dbp: Number(form.dbp),
      heart_rate: form.heart_rate ? Number(form.heart_rate) : undefined,
      glucose: form.glucose ? Number(form.glucose) : undefined,
      hba1c: form.hba1c ? Number(form.hba1c) : undefined,
      medications: {
        antihypertensive: form.med_antihypertensive,
        antidiabetic: form.med_antidiabetic,
        statin: form.med_statin,
      },
      conditions: {
        essential_hypertension: form.cond_hypertension,
        type_2_diabetes: form.cond_diabetes,
        cardiovascular_disease: form.cond_cvd,
        chronic_kidney_disease: form.cond_ckd,
      },
      smoking: form.smoking,
      family_history_hypertension: form.family_history,
      salt_intake: form.salt_intake,
      physical_activity: form.physical_activity,
    };

    try {
      const res = await registerPatient(payload);
      // Clear draft on successful registration
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      // Navigate to twin dashboard with newly registered patient
      router.push(`/twin?patient=${encodeURIComponent(res.patient_id)}`);
    } catch (err: unknown) {
      console.error("Registration failed:", err);
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
          setGlobalError("Field validation failed. Review the inputs indicated below.");
        } else {
          setGlobalError(err.message);
        }
      } else {
        setGlobalError("An unexpected network error occurred while registering patient.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner & Title */}
      <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-2xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                Patient Intake
              </span>
              <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full font-bold">
                Synthetic Intake
              </span>
            </div>
            <h1 className="font-editorial text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-1">
              Register New Patient Twin
            </h1>
            <p className="text-xs text-[var(--text-muted)] max-w-xl mt-0.5 leading-relaxed">
              Synthesize a clinical profile from baseline vitals and labs. Computes 132 features, Platt-calibrated risk, and signed SHAP drivers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] glass-card border border-[var(--border-subtle)] rounded-xl transition-colors cursor-pointer"
              title="Reset form"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {draftSavedMsg && (
          <div className="mt-3 p-2 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{draftSavedMsg}</span>
          </div>
        )}

        {/* Regulatory & Privacy Guardrail Banner */}
        <div className="mt-3 p-3 glass-card bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>DPDP Act &amp; Safety Notice:</strong> Synthetic research prototype. Do not enter real citizen PII, Aadhaar numbers, or real clinical identities.
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 shrink-0 hidden sm:inline">
            Zero PHI Policy
          </span>
        </div>
      </div>

      {/* Wizard Progress Indicator */}
      <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs">
        <div className="grid grid-cols-4 gap-2 text-xs">
          {[
            { step: 1, label: "1. Demographics & Basics", icon: User },
            { step: 2, label: "2. Vitals & Labs", icon: HeartPulse },
            { step: 3, label: "3. Meds & History", icon: Pill },
            { step: 4, label: "4. Review & Register", icon: FileCheck },
          ].map(({ step, label, icon: Icon }) => {
            const isActive = currentStep === step;
            const isCompleted = currentStep > step;
            return (
              <button
                key={step}
                type="button"
                onClick={() => {
                  if (step < currentStep) setCurrentStep(step);
                  else if (step === 2 && validateStep1()) setCurrentStep(2);
                  else if (step === 3 && validateStep1() && validateStep2()) setCurrentStep(3);
                }}
                className={`p-2.5 rounded text-left transition-colors flex items-center gap-2 border ${
                  isActive
                    ? "bg-[var(--accent-teal-subtle)] border-[var(--accent-teal-border)] text-[var(--accent-teal)] font-semibold"
                    : isCompleted
                    ? "bg-[var(--bg-subtle)] border-stone-200 text-stone-700"
                    : "border-transparent text-stone-400"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                    isActive
                      ? "bg-[var(--accent-teal)] text-white"
                      : isCompleted
                      ? "bg-teal-700 text-white"
                      : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {isCompleted ? "✓" : step}
                </div>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Main Form Body */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: BASICS & DEMOGRAPHICS */}
        {currentStep === 1 && (
          <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-2xs space-y-5">
            <div className="border-b border-[var(--border-hairline)] pb-3">
              <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                Step 1: Patient Alias & Physical Baseline
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Basic physiological coordinates used for baseline demographic risk strata and BMI derivations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Alias / Identifier */}
              <div className="space-y-1">
                <label className="font-medium text-[var(--text-secondary)]">
                  Synthetic Alias / Case Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                  placeholder="e.g. Test Patient 2026-A"
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs focus:ring-1 focus:ring-[var(--accent-teal)] focus:outline-none"
                />
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Synthetic identifier only. Do not input real names.
                </span>
              </div>

              {/* Age */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">
                    Age (Years) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Range: 18–115</span>
                </div>
                <input
                  type="number"
                  min={18}
                  max={115}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.age ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.age && <p className="text-[10px] text-red-600">{fieldErrors.age}</p>}
              </div>

              {/* Sex / Gender */}
              <div className="space-y-1">
                <label className="font-medium text-[var(--text-secondary)]">
                  Biological Sex <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs focus:outline-none"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Used by model for baseline sex-specific risk coefficients.
                </span>
              </div>

              {/* Height */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">Height (cm)</label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Range: 80–250</span>
                </div>
                <input
                  type="number"
                  min={80}
                  max={250}
                  value={form.height_cm}
                  onChange={(e) => setForm({ ...form, height_cm: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.height_cm ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.height_cm && <p className="text-[10px] text-red-600">{fieldErrors.height_cm}</p>}
              </div>

              {/* Weight */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">Weight (kg)</label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Range: 25–300</span>
                </div>
                <input
                  type="number"
                  min={25}
                  max={300}
                  step={0.5}
                  value={form.weight_kg}
                  onChange={(e) => setForm({ ...form, weight_kg: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.weight_kg ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.weight_kg && <p className="text-[10px] text-red-600">{fieldErrors.weight_kg}</p>}
              </div>

              {/* Calculated BMI Badge */}
              <div className="space-y-1">
                <label className="font-medium text-[var(--text-secondary)]">Calculated BMI (kg/m²)</label>
                <div className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs font-mono flex items-center justify-between">
                  <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                    {computedBmi ? `${computedBmi} kg/m²` : "Provide height & weight"}
                  </span>
                  {computedBmi && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        computedBmi < 18.5
                          ? "bg-blue-100 text-blue-800"
                          : computedBmi < 25
                          ? "bg-emerald-100 text-emerald-800"
                          : computedBmi < 30
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {computedBmi < 18.5 ? "Underweight" : computedBmi < 25 ? "Normal" : computedBmi < 30 ? "Overweight" : "Obese"}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Automatically derived from entered height and weight coordinates.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: VITALS & LABS */}
        {currentStep === 2 && (
          <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-2xs space-y-5">
            <div className="border-b border-[var(--border-hairline)] pb-3">
              <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                Step 2: Vital Signs & Laboratory Measurements
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Key numerical indicators evaluated against physiological limits and normal reference ranges.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* SBP */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">
                    Systolic Blood Pressure (mmHg) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Normal &lt;120 · Valid: 60–260</span>
                </div>
                <input
                  type="number"
                  min={60}
                  max={260}
                  value={form.sbp}
                  onChange={(e) => setForm({ ...form, sbp: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.sbp ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.sbp && <p className="text-[10px] text-red-600">{fieldErrors.sbp}</p>}
              </div>

              {/* DBP */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">
                    Diastolic Blood Pressure (mmHg) <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Normal &lt;80 · Valid: 35–160</span>
                </div>
                <input
                  type="number"
                  min={35}
                  max={160}
                  value={form.dbp}
                  onChange={(e) => setForm({ ...form, dbp: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.dbp ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.dbp && <p className="text-[10px] text-red-600">{fieldErrors.dbp}</p>}
              </div>

              {/* Heart Rate */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">Heart Rate (bpm)</label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Normal 60–100 · Valid: 30–220</span>
                </div>
                <input
                  type="number"
                  min={30}
                  max={220}
                  value={form.heart_rate}
                  onChange={(e) => setForm({ ...form, heart_rate: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.heart_rate ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.heart_rate && <p className="text-[10px] text-red-600">{fieldErrors.heart_rate}</p>}
              </div>

              {/* Pulse Pressure Derivation */}
              <div className="space-y-1">
                <label className="font-medium text-[var(--text-secondary)]">Pulse Pressure (mmHg)</label>
                <div className="px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs font-mono tabular-nums text-[var(--text-primary)]">
                  {form.sbp && form.dbp ? `${Number(form.sbp) - Number(form.dbp)} mmHg` : "Requires SBP & DBP"}
                </div>
                <span className="text-[10px] text-[var(--text-muted)] block">
                  Recomputed dynamically; high pulse pressure (&gt;50 mmHg) elevates vascular stiffness risk.
                </span>
              </div>

              {/* Fasting Glucose */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">Fasting Glucose (mg/dL)</label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Normal 70–99 · Valid: 40–500</span>
                </div>
                <input
                  type="number"
                  min={40}
                  max={500}
                  value={form.glucose}
                  onChange={(e) => setForm({ ...form, glucose: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.glucose ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.glucose && <p className="text-[10px] text-red-600">{fieldErrors.glucose}</p>}
              </div>

              {/* HbA1c */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="font-medium text-[var(--text-secondary)]">HbA1c Glycated Hemoglobin (%)</label>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">Normal &lt;5.7% · Valid: 3.5–18.0</span>
                </div>
                <input
                  type="number"
                  min={3.5}
                  max={18.0}
                  step={0.1}
                  value={form.hba1c}
                  onChange={(e) => setForm({ ...form, hba1c: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={`w-full px-3 py-2 bg-[var(--bg-subtle)] border rounded text-xs font-mono tabular-nums focus:outline-none ${
                    fieldErrors.hba1c ? "border-red-400 bg-red-50" : "border-[var(--border-hairline)] focus:ring-1 focus:ring-[var(--accent-teal)]"
                  }`}
                />
                {fieldErrors.hba1c && <p className="text-[10px] text-red-600">{fieldErrors.hba1c}</p>}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: MEDICATIONS & CLINICAL HISTORY */}
        {currentStep === 3 && (
          <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-2xs space-y-5">
            <div className="border-b border-[var(--border-hairline)] pb-3">
              <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                Step 3: Active Medications & Clinical History
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Pharmaceutical regimen, diagnosed conditions, and lifestyle context.
              </p>
            </div>

            {/* Medications Toggles */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-mono">
                Pharmacotherapy Regimen
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.med_antihypertensive}
                    onChange={(e) => setForm({ ...form, med_antihypertensive: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <div>
                    <span className="font-medium text-[var(--text-primary)] block">Antihypertensive</span>
                    <span className="text-[10px] text-[var(--text-muted)]">ACEi, ARB, CCB or Diuretic</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.med_antidiabetic}
                    onChange={(e) => setForm({ ...form, med_antidiabetic: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <div>
                    <span className="font-medium text-[var(--text-primary)] block">Antidiabetic Agent</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Metformin, SGLT2i, Insulin</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.med_statin}
                    onChange={(e) => setForm({ ...form, med_statin: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <div>
                    <span className="font-medium text-[var(--text-primary)] block">Lipid-Lowering Statin</span>
                    <span className="text-[10px] text-[var(--text-muted)]">Atorvastatin, Rosuvastatin</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Existing Conditions */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-mono">
                Documented Conditions
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.cond_hypertension}
                    onChange={(e) => setForm({ ...form, cond_hypertension: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <span className="font-medium text-[var(--text-primary)]">Essential Hypertension (I10)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.cond_diabetes}
                    onChange={(e) => setForm({ ...form, cond_diabetes: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <span className="font-medium text-[var(--text-primary)]">Type 2 Diabetes Mellitus (E11)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.cond_cvd}
                    onChange={(e) => setForm({ ...form, cond_cvd: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <span className="font-medium text-[var(--text-primary)]">Cardiovascular Disease (I25 / I50)</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={form.cond_ckd}
                    onChange={(e) => setForm({ ...form, cond_ckd: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <span className="font-medium text-[var(--text-primary)]">Chronic Kidney Disease (N18)</span>
                </label>
              </div>
            </div>

            {/* Lifestyle & Clinical Context (labeled as context) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider font-mono">
                  Lifestyle Context
                </h3>
                <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-hairline)]">
                  Stored as clinical context · not directly in XGBoost feature space
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-secondary)]">Dietary Sodium / Salt Intake</label>
                  <select
                    value={form.salt_intake}
                    onChange={(e) => setForm({ ...form, salt_intake: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs focus:outline-none"
                  >
                    <option value="low">Low Sodium (&lt;2g/day)</option>
                    <option value="normal">Standard / Moderate</option>
                    <option value="high">High Dietary Sodium (&gt;5g/day)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-[var(--text-secondary)]">Physical Activity Level</label>
                  <select
                    value={form.physical_activity}
                    onChange={(e) => setForm({ ...form, physical_activity: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded text-xs focus:outline-none"
                  >
                    <option value="sedentary">Sedentary (&lt;3,000 steps/day)</option>
                    <option value="moderate">Moderate Exercise (30 min/day)</option>
                    <option value="active">Active (&gt;10,000 steps/day)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={form.smoking}
                    onChange={(e) => setForm({ ...form, smoking: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <span className="font-medium text-[var(--text-secondary)]">Current tobacco smoker</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={form.family_history}
                    onChange={(e) => setForm({ ...form, family_history: e.target.checked })}
                    className="accent-[var(--accent-teal)] rounded w-4 h-4"
                  />
                  <span className="font-medium text-[var(--text-secondary)]">First-degree family history of hypertension</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & REGISTRATION */}
        {currentStep === 4 && (
          <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] shadow-2xs space-y-6">
            <div className="border-b border-[var(--border-hairline)] pb-3">
              <h2 className="font-editorial text-lg font-bold text-[var(--text-primary)]">
                Step 4: Clinical Review & Twin Creation
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Inspect parsed variables, review data completeness score, and confirm research compliance before initialization.
              </p>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Demographics</span>
                <p className="font-semibold text-[var(--text-primary)]">{form.alias || "Synthetic Case"}</p>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  {form.age} years · {form.gender}
                </p>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  {form.height_cm ? `${form.height_cm} cm` : "—"} · {form.weight_kg ? `${form.weight_kg} kg` : "—"} ({computedBmi ? `BMI ${computedBmi}` : "—"})
                </p>
              </div>

              <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Baseline Vitals</span>
                <p className="font-semibold text-[var(--text-primary)] font-mono text-sm">
                  {form.sbp}/{form.dbp} <span className="text-xs font-normal text-[var(--text-muted)]">mmHg</span>
                </p>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  Heart Rate: {form.heart_rate ? `${form.heart_rate} bpm` : "Estimated"}
                </p>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  Glucose: {form.glucose ? `${form.glucose} mg/dL` : "Estimated"} · HbA1c: {form.hba1c ? `${form.hba1c}%` : "Estimated"}
                </p>
              </div>

              <div className="p-3 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-1">
                <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Clinical Status</span>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  HTN Meds: {form.med_antihypertensive ? "Active" : "None"}
                </p>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  Conditions: {[
                    form.cond_hypertension ? "HTN" : null,
                    form.cond_diabetes ? "T2D" : null,
                    form.cond_cvd ? "CVD" : null,
                  ].filter(Boolean).join(", ") || "None"}
                </p>
                <p className="text-[var(--text-secondary)] font-mono text-[11px]">
                  Dietary Salt: {form.salt_intake} · Smoke: {form.smoking ? "Yes" : "No"}
                </p>
              </div>
            </div>

            {/* Completeness & Low Data Notice */}
            <div className="p-4 bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">
                  Feature Completeness: ~{estimatedCompleteness}%
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  Single-encounter baseline registration
                </span>
              </div>
              <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[var(--accent-teal)] h-full transition-all duration-300"
                  style={{ width: `${estimatedCompleteness}%` }}
                />
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Honest Notice (LOW_DATA): </strong>
                  Single registration lacks longitudinal 12-month trend observations (such as 365-day slopes and historical encounter counts).
                  Unobserved trend columns are set to unobserved missing values and handled by the pipeline imputer—never artificially fabricated.
                </span>
              </div>
            </div>

            {/* Consent & DPDP Notice */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-2.5 p-3 bg-stone-50 border border-[var(--border-hairline)] rounded cursor-pointer hover:bg-stone-100 transition-colors">
                <input
                  type="checkbox"
                  checked={form.consent_confirmed}
                  onChange={(e) => setForm({ ...form, consent_confirmed: e.target.checked })}
                  className="accent-[var(--accent-teal)] rounded w-4 h-4 mt-0.5 shrink-0"
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Research Prototype & Synthetic Confirmation Statement
                  </span>
                  <span className="text-[var(--text-muted)] leading-relaxed block">
                    I confirm this record consists of synthetic or simulated research coordinates and does not represent real personally identifiable health data.
                    I acknowledge that risk outputs reflect algorithmic estimation, not certified clinical diagnoses or treatment directives.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-2">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-stone-200 border border-[var(--border-hairline)] rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href="/patients"
              className="text-xs text-[var(--text-muted)] hover:text-stone-700 transition-colors"
            >
              ← Cancel & return to Directory
            </Link>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] rounded transition-colors shadow-2xs"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting || !form.consent_confirmed}
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded transition-colors shadow-2xs ${
                submitting || !form.consent_confirmed
                  ? "bg-stone-300 text-stone-500 cursor-not-allowed"
                  : "bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)]"
              }`}
            >
              {submitting ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Deriving 132 Features & Calibrating Risk…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Register Patient Twin & Open Dashboard</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

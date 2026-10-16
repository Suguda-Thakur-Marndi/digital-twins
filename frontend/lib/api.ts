/**
 * TwinCare / Pramana Clinical Twin API Client
 * Connects Next.js frontend to FastAPI backend (/api/v1).
 * Strictly typed interfaces mirroring the backend Pydantic models.
 */

const rawApiBase =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

export const API_BASE = rawApiBase.trim().replace(/\/+$/, "");

export class ApiError extends Error {
  public fieldErrors?: Record<string, string>;
  constructor(public status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.fieldErrors = fieldErrors;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...options,
    });
    if (!res.ok) {
      let detail = `Request failed with status ${res.status}`;
      let fieldErrors: Record<string, string> | undefined = undefined;
      try {
        const errJson = await res.json();
        if (typeof errJson.detail === "string") {
          detail = errJson.detail;
        } else if (errJson.detail && typeof errJson.detail === "object") {
          detail = errJson.detail.message || JSON.stringify(errJson.detail);
          fieldErrors = errJson.detail.field_errors;
        }
        if (errJson.field_errors) {
          fieldErrors = errJson.field_errors;
        }
      } catch {
        // fallback
      }
      throw new ApiError(res.status, detail, fieldErrors);
    }
    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(503, `Cannot reach TwinCare backend at ${API_BASE}. Ensure backend is running.`);
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  model_version: string;
  schema_fingerprint: string;
  feature_count: number;
  model_loaded: boolean;
  project: string;
}

export interface ModelMetrics {
  roc_auc: number;
  roc_auc_ci_95: [number, number];
  pr_auc: number;
  base_rate: number;
  total_supervised_rows: number;
  total_patients: number;
  positive_events_total: number;
  positive_events_test: number;
}

export interface CalibrationInfo {
  method: string;
  calibrator_coef: number;
  calibrator_intercept: number;
  uncalibrated_warning: string;
}

export interface RiskTierSpec {
  min_risk?: number;
  max_risk?: number;
  label: string;
  clinical_action: string;
}

export interface ModelInfo {
  model_name: string;
  working_project: string;
  version: string;
  condition: string;
  target_outcome: string;
  prediction_horizon_days: number;
  lookback_history_days: number;
  training_date: string;
  schema_fingerprint: string;
  metrics: ModelMetrics;
  calibration: CalibrationInfo;
  risk_tiers: Record<string, RiskTierSpec>;
  alert_threshold: number;
  validation_threshold: number;
  data_source: string;
  limitations: string[];
  disclaimer: string;
}

export interface PatientSummary {
  id: string;
  patient_id: string;
  display_id: string;
  display_label: string;
  name: string;
  age: number;
  age_band: string;
  gender: string;
  sex: string;
  latest_date?: string;
  as_of_date?: string;
  risk_tier: "Low" | "Moderate" | "High";
  risk_score: number;
  calibrated_risk: number;
  raw_score: number;
  latest_sbp?: number;
  latest_dbp?: number;
  sparkline_sbp: number[];
  data_completeness_pct: number;
  is_registered?: boolean;
  is_demo?: boolean;
}

export interface VitalSigns {
  sbp?: number | null;
  dbp?: number | null;
  bmi?: number | null;
  weight?: number | null;
  hr?: number | null;
  glucose?: number | null;
  hba1c?: number | null;
  pulse_pressure?: number | null;
}

export interface RiskState {
  raw_score: number;
  calibrated_risk: number;
  risk_tier: "Low" | "Moderate" | "High";
  percentile_in_cohort?: number;
  confidence_interval_95?: [number, number];
}

export interface ConditionItem {
  name: string;
  display_name?: string;
  icd10?: string;
  onset_years_prior?: number;
}

export interface MedicationItem {
  name: string;
  display_name?: string;
  dosage?: string;
  class?: string;
  active: boolean;
}

export interface SnapshotItem {
  snapshot_id: string;
  date: string;
  sbp?: number | null;
  dbp?: number | null;
  bmi?: number | null;
  weight?: number | null;
  hr?: number | null;
  raw_score: number;
  calibrated_risk: number;
  risk_tier: "Low" | "Moderate" | "High";
  stage_2_decompensation: boolean;
}

export interface TimelineVitalItem {
  date: string;
  sbp: number;
  dbp: number;
  bmi: number;
  weight: number;
  hr: number;
}

export interface PatientDetail {
  id: string;
  patient_id: string;
  display_id: string;
  display_label: string;
  name: string;
  age: number;
  age_band: string;
  gender: string;
  sex: string;
  race?: string;
  ethnicity?: string;
  as_of_date?: string;
  latest_vitals: VitalSigns;
  latest_risk: RiskState;
  data_completeness_pct: number;
  sparkline_sbp: number[];
  conditions: ConditionItem[];
  medications: MedicationItem[];
  snapshots: SnapshotItem[];
  timeline_vitals: TimelineVitalItem[];
  feature_row?: Record<string, unknown>;
  warnings?: string[];
  is_registered?: boolean;
  is_demo?: boolean;
}

export interface ContributingFactor {
  feature: string;
  label: string;
  impact: number;
  abs_impact: number;
  direction: "increases_risk" | "reduces_risk";
  observed_value?: number | string | null;
}

export interface PredictResponse {
  patient_id?: string;
  raw_score: number;
  calibrated_risk: number;
  risk_tier: "Low" | "Moderate" | "High";
  confidence_interval_95: [number, number];
  top_contributing_factors: ContributingFactor[];
  data_completeness: number;
  alert_triggered: boolean;
  caveat: string;
  audit?: Record<string, unknown>;
}

export interface WhatIfResponse {
  patient_id: string;
  baseline_raw: number;
  baseline_risk: number;
  baseline_tier: string;
  scenario_raw: number;
  scenario_risk: number;
  scenario_tier: string;
  delta_risk_pp: number;
  delta_raw_pp: number;
  features_changed_count: number;
  features_changed: string[];
  sbp_delta_applied: number;
  weight_change_pct_applied: number;
  is_out_of_distribution: boolean;
  out_of_distribution_warnings: string[];
  caveat: string;
  // Legacy aliases
  change_pp: number;
  simulated_tier: string;
  baseline_score: number;
  simulated_score: number;
  disclaimer?: string;
}

export interface AuditEntry {
  [key: string]: unknown;
  timestamp: string;
  model_version: string;
  schema_fingerprint: string;
  input_hash: string;
  score: number;
  calibrated_risk?: number;
  risk_tier?: string;
  context?: string;
}

export interface AuditLogResponse {
  entries: AuditEntry[];
}

export interface TimelineSnapshot {
  prediction_time: string;
  sbp: number | null;
  dbp: number | null;
  bmi: number | null;
  weight: number | null;
  hr: number | null;
  risk_score: number;
  risk_tier: string;
  target_label: number | null;
}

export interface TimelineResponse {
  patient_id: string;
  snapshots: TimelineSnapshot[];
}

export async function fetchTimeline(patientId: string): Promise<TimelineResponse> {
  return apiFetch<TimelineResponse>(`/api/patients/${encodeURIComponent(patientId)}/timeline`);
}

export interface TimelineRiskResponse {
  patient_id: string;
  snapshots: SnapshotItem[];
}

export interface GlobalDriverItem {
  rank: number;
  feature: string;
  display_name: string;
  category: string;
  relative_importance: number;
  clinical_rationale: string;
}

export interface GlobalExplainResponse {
  title: string;
  method: string;
  cohort_size: number;
  top_features: GlobalDriverItem[];
}

export interface DailyWearableReading {
  date: string;
  resting_heart_rate: number;
  daily_steps: number;
  home_bp_morning: string;
  home_bp_evening: string;
  home_sbp_mean: number;
  home_dbp_mean: number;
  sleep_hours: number;
  spo2_percent: number;
  simulated: boolean;
}

export interface WearableSummary {
  avg_resting_hr: number;
  resting_hr_std?: number;
  avg_daily_steps: number;
  avg_home_sbp: number;
  home_sbp_std?: number;
  avg_home_dbp: number;
  home_dbp_std?: number;
  avg_sleep_hours: number;
  avg_spo2?: number;
}

export interface WearableResponse {
  patient_id: string;
  simulated: boolean;
  tag: string;
  days_count: number;
  summary: WearableSummary;
  alert_flags?: string[];
  daily_readings: DailyWearableReading[];
  disclaimer: string;
}

export interface AuditEntry {
  timestamp: string;
  model_version: string;
  schema_fingerprint: string;
  input_hash: string;
  score: number;
  calibrated_risk?: number;
  risk_tier?: string;
  context?: string;
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/v1/health");
}

export async function fetchModelInfo(): Promise<ModelInfo> {
  return apiFetch<ModelInfo>("/api/v1/model/info");
}

export async function fetchPatients(limit = 100): Promise<PatientSummary[]> {
  return apiFetch<PatientSummary[]>(`/api/v1/patients?limit=${limit}`);
}

export async function fetchPatient(id: string): Promise<PatientDetail> {
  return apiFetch<PatientDetail>(`/api/v1/patients/${encodeURIComponent(id)}`);
}

export async function fetchPredict(patientId: string): Promise<PredictResponse> {
  return apiFetch<PredictResponse>("/api/v1/predict", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId }),
  });
}

export async function fetchWhatIf(
  patientId: string,
  sbpDelta: number,
  weightChangePct: number
): Promise<WhatIfResponse> {
  return apiFetch<WhatIfResponse>("/api/v1/whatif", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      sbp_delta: sbpDelta,
      weight_change_pct: weightChangePct,
    }),
  });
}

export async function fetchTimelineRisk(patientId: string): Promise<TimelineRiskResponse> {
  return apiFetch<TimelineRiskResponse>(`/api/v1/patients/${encodeURIComponent(patientId)}/timeline-risk`);
}

export async function fetchGlobalExplain(): Promise<GlobalExplainResponse> {
  return apiFetch<GlobalExplainResponse>("/api/v1/explain/global");
}

export async function fetchSimulatedWearable(patientId: string, days = 14): Promise<WearableResponse> {
  return apiFetch<WearableResponse>("/api/v1/simulate/wearable", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, days }),
  });
}

export async function fetchAuditLog(limit = 50): Promise<AuditLogResponse> {
  return apiFetch<AuditLogResponse>(`/api/v1/audit?limit=${limit}`);
}

// ── Legacy Compatibility Exports ─────────────────────────────────────────────

export interface CalibrationPoint {
  bin: number;
  predicted_risk: number;
  observed_fraction: number;
  sample_count: number;
}

export interface AlertBudgetItem {
  tier: string;
  percent_flagged: number;
  patients_flagged: number;
  raw_threshold: number;
  calibrated_threshold: number;
  true_positives: number;
  false_positives: number;
  precision: number;
  precision_ci_95: [number, number];
  recall: number;
  recall_ci_95: [number, number];
  clinical_interpretation: string;
}

export interface ModelPerformance {
  roc_auc: number;
  roc_auc_ci: [number, number];
  pr_auc: number;
  event_rate: number;
  positive_cases: number;
  total_rows: number;
  test_positives: number;
  test_negatives: number;
  validation_threshold: number;
  threshold_tp: number;
  threshold_fp: number;
  threshold_fn: number;
  threshold_tn: number;
  honest_threshold_statement?: string;
  calibration_curve?: CalibrationPoint[];
  alert_budget_table?: AlertBudgetItem[];
  limitations: string[];
  disclaimer: string;
}

export async function fetchModelPerformance(): Promise<ModelPerformance> {
  return apiFetch<ModelPerformance>("/api/model/performance");
}

export interface PopulationPatient {
  patient_id: string;
  id?: string;
  age: number | null;
  gender: string | null;
  risk_score: number;
  risk_tier: string;
}

export interface PopulationResponse {
  data: PopulationPatient[];
  disclaimer: string;
  total: number;
}

export async function fetchPopulation(
  ageBand?: string,
  gender?: string,
  riskTier?: string
): Promise<PopulationResponse> {
  const params = new URLSearchParams();
  if (ageBand) params.set("age_band", ageBand);
  if (gender) params.set("gender", gender);
  if (riskTier) params.set("risk_tier", riskTier);
  const qs = params.toString();
  return apiFetch<PopulationResponse>(`/api/population${qs ? `?${qs}` : ""}`);
}

// ── Full Patient Simulator & Sensitivity Interfaces ──────────────────────────

export interface SimulateRequest {
  patient_id: string;
  sbp_value?: number | null;
  sbp_delta?: number | null;
  dbp_value?: number | null;
  dbp_delta?: number | null;
  hr_value?: number | null;
  hr_delta?: number | null;
  weight_value?: number | null;
  weight_delta_pct?: number | null;
  glucose_value?: number | null;
  glucose_delta?: number | null;
  hba1c_value?: number | null;
  hba1c_delta?: number | null;
  trend?: "improving" | "stable" | "worsening" | null;
  conditions?: Record<string, number> | null;
  medications?: Record<string, number> | null;
  custom_features?: Record<string, unknown> | null;
}

export interface SHAPDiffItem {
  feature: string;
  human_name: string;
  attribution_diff: number;
  attribution_before: number;
  attribution_after: number;
}

export interface SimulateResponse {
  patient_id: string;
  baseline_raw: number;
  baseline_risk: number;
  baseline_tier: string;
  scenario_raw: number;
  scenario_risk: number;
  scenario_tier: string;
  delta_risk_pp: number;
  delta_raw_pp: number;
  tier_changed: boolean;
  shap_before: ContributingFactor[];
  shap_after: ContributingFactor[];
  shap_diff: SHAPDiffItem[];
  features_changed: string[];
  warnings: string[];
  is_out_of_range: boolean;
  is_low_sensitivity: boolean;
  sensitivity_message: string | null;
  caveat: string;
}

export interface SensitivityPoint {
  value: number;
  raw_score: number;
  calibrated_risk: number;
  risk_tier: string;
}

export interface SensitivityCurve {
  variable: string;
  display_name: string;
  unit: string;
  current_value: number;
  points: SensitivityPoint[];
}

export interface SensitivityResponse {
  patient_id: string;
  curves: Record<string, SensitivityCurve>;
}

export async function fetchSimulate(payload: SimulateRequest): Promise<SimulateResponse> {
  return apiFetch<SimulateResponse>("/api/v1/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchSensitivity(patientId: string): Promise<SensitivityResponse> {
  return apiFetch<SensitivityResponse>(`/api/v1/patients/${encodeURIComponent(patientId)}/sensitivity`);
}

// ── Live Stream Telemetry ─────────────────────────────────────────────────────

export interface StreamReadingRequest {
  patient_id: string;
  reading_type?: string;
  sbp?: number | null;
  dbp?: number | null;
  hr?: number | null;
  spo2?: number | null;
  steps?: number | null;
  timestamp?: string | null;
}

export interface StreamReadingResponse {
  patient_id: string;
  simulated: boolean;
  reading_accepted: boolean;
  reading_logged: Record<string, any>;
  wearable_summary: Record<string, any>;
  alert_flags: string[];
  updated_vitals: Record<string, any>;
  updated_risk: Record<string, any>;
  disclaimer: string;
}

export async function postStreamReading(payload: StreamReadingRequest): Promise<StreamReadingResponse> {
  return apiFetch<StreamReadingResponse>("/api/v1/stream/reading", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Alerts & Early Warning ────────────────────────────────────────────────────

export interface AlertPatientItem {
  patient_id: string;
  display_label: string;
  current_risk: number;
  previous_risk: number;
  risk_rise_pp: number;
  risk_tier: string;
  first_crossed_date: string | null;
  lead_time_days: number | null;
  had_event: boolean;
  alert_reason: string;
}

export interface AlertsResponse {
  window_snapshots: number;
  alert_threshold: number;
  flagged_count: number;
  patients: AlertPatientItem[];
}

export async function fetchAlerts(windowSnapshots = 3): Promise<AlertsResponse> {
  return apiFetch<AlertsResponse>(`/api/v1/alerts?window=${windowSnapshots}`);
}

// ── ABDM FHIR Ingestion ───────────────────────────────────────────────────────

export interface FHIRMappingReport {
  valid: boolean;
  patient_id: string | null;
  demographics: Record<string, any>;
  observations_mapped: number;
  conditions_mapped: number;
  medications_mapped: number;
  features_populated: number;
  validation_errors: string[];
  mapping_summary: Array<{ field: string; source: string; value: string }>;
  simulated_prediction: Record<string, any> | null;
}

export async function postFHIRImport(bundle: unknown): Promise<FHIRMappingReport> {
  return apiFetch<FHIRMappingReport>("/api/v1/import/fhir", {
    method: "POST",
    body: JSON.stringify({ bundle }),
  });
}

// ── Audit Integrity ───────────────────────────────────────────────────────────

export interface AuditVerifyResponse {
  is_valid: boolean;
  total_entries: number;
  tampered_at_index: number | null;
  first_hash: string | null;
  last_hash: string | null;
  message: string;
}

export async function verifyAuditLog(): Promise<AuditVerifyResponse> {
  return apiFetch<AuditVerifyResponse>("/api/v1/audit/verify", {
    method: "POST",
  });
}

// ── Patient Registration & Dynamic Readings ───────────────────────────────────

export interface ClinicalReadingInput {
  date?: string;
  sbp: number;
  dbp: number;
  hr?: number;
  weight?: number;
  bmi?: number;
  glucose?: number;
  hba1c?: number;
}

export interface PatientRegisterRequest {
  display_name?: string;
  alias?: string;
  age: number;
  gender: string;
  race?: string;
  ethnicity?: string;
  height_cm?: number;
  weight_kg?: number;
  bmi?: number;
  sbp: number;
  dbp: number;
  heart_rate?: number;
  glucose?: number;
  hba1c?: number;
  readings?: ClinicalReadingInput[];
  medications?: Record<string, boolean>;
  conditions?: Record<string, boolean>;
  smoking?: boolean;
  family_history_hypertension?: boolean;
  salt_intake?: string;
  physical_activity?: string;
  custom_features?: Record<string, unknown>;
}

export interface PatientRegisterResponse {
  patient_id: string;
  display_id: string;
  display_label: string;
  is_registered: boolean;
  is_demo: boolean;
  as_of_date: string;
  latest_vitals: Record<string, any>;
  calibrated_risk: number;
  raw_score: number;
  ci_lower: number;
  ci_upper: number;
  risk_tier: string;
  data_completeness_pct: number;
  top_contributing_factors: ContributingFactor[];
  warnings: string[];
  patient_twin: Record<string, any>;
  caveat: string;
}

export interface AddReadingRequest {
  date?: string;
  sbp: number;
  dbp: number;
  hr?: number;
  weight?: number;
  glucose?: number;
  hba1c?: number;
}

export interface AddReadingResponse {
  patient_id: string;
  readings_count: number;
  latest_vitals: Record<string, any>;
  updated_risk: Record<string, any>;
  snapshots: Array<Record<string, any>>;
  warnings: string[];
}

export async function registerPatient(payload: PatientRegisterRequest): Promise<PatientRegisterResponse> {
  return apiFetch<PatientRegisterResponse>("/api/v1/patients/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function addPatientReading(patientId: string, payload: AddReadingRequest): Promise<AddReadingResponse> {
  return apiFetch<AddReadingResponse>(`/api/v1/patients/${encodeURIComponent(patientId)}/readings`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deletePatient(patientId: string): Promise<{ patient_id: string; deleted: boolean; message: string }> {
  return apiFetch<{ patient_id: string; deleted: boolean; message: string }>(`/api/v1/patients/${encodeURIComponent(patientId)}`, {
    method: "DELETE",
  });
}


"""
Pydantic schemas for VitalTwin — AI-Powered Clinical Digital Twin FastAPI service.
All request and response contracts are strictly validated.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict


# ── Health ─────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    model_version: str = "1.0.0"
    schema_fingerprint: str
    schema_hash: Optional[str] = None
    feature_count: int
    model_loaded: bool = True
    project: str = "VitalTwin"


# ── Model Info / Metadata ──────────────────────────────────────────────────────

class ModelMetricCI(BaseModel):
    lower: float
    upper: float


class ModelMetrics(BaseModel):
    roc_auc: float
    roc_auc_ci_95: List[float]
    pr_auc: float
    base_rate: float
    total_supervised_rows: int
    total_patients: int
    positive_events_total: int
    positive_events_test: int


class CalibrationInfo(BaseModel):
    method: str
    calibrator_coef: float
    calibrator_intercept: float
    uncalibrated_warning: str


class RiskTierSpec(BaseModel):
    min_risk: Optional[float] = None
    max_risk: Optional[float] = None
    label: str
    clinical_action: str


class ModelInfoResponse(BaseModel):
    model_name: str
    working_project: str
    version: str
    condition: str
    target_outcome: str
    prediction_horizon_days: int
    lookback_history_days: int
    training_date: str
    schema_fingerprint: str
    metrics: ModelMetrics
    calibration: CalibrationInfo
    risk_tiers: Dict[str, RiskTierSpec]
    alert_threshold: float
    validation_threshold: float
    data_source: str
    limitations: List[str]
    disclaimer: str


# ── Patients ───────────────────────────────────────────────────────────────────

class PatientSummaryItem(BaseModel):
    patient_id: str = Field(..., alias="id")
    id: str
    display_id: str
    display_label: str
    name: str
    age: int
    age_band: str
    gender: str
    sex: str
    latest_date: Optional[str] = None
    as_of_date: Optional[str] = None
    risk_tier: str
    risk_score: float
    calibrated_risk: float
    raw_score: float
    latest_sbp: Optional[float] = None
    latest_dbp: Optional[float] = None
    sparkline_sbp: List[float] = Field(default_factory=list)
    data_completeness_pct: float = 95.0
    is_registered: Optional[bool] = False
    is_demo: Optional[bool] = True

    model_config = ConfigDict(populate_by_name=True)


class VitalSigns(BaseModel):
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    bmi: Optional[float] = None
    weight: Optional[float] = None
    height: Optional[float] = None
    hr: Optional[float] = None
    glucose: Optional[float] = None
    hba1c: Optional[float] = None
    pulse_pressure: Optional[float] = None


class RiskState(BaseModel):
    raw_score: float
    calibrated_risk: float
    risk_tier: str
    percentile_in_cohort: Optional[float] = None
    confidence_interval_95: Optional[List[float]] = None
    ci_lower: Optional[float] = None
    ci_upper: Optional[float] = None


class ConditionItem(BaseModel):
    name: str
    icd10: Optional[str] = None
    onset_years_prior: Optional[int] = None


class MedicationItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    active: bool = True

    model_config = ConfigDict(populate_by_name=True)


class SnapshotItem(BaseModel):
    snapshot_id: str
    date: str
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    bmi: Optional[float] = None
    weight: Optional[float] = None
    hr: Optional[float] = None
    raw_score: float
    calibrated_risk: float
    risk_tier: str
    stage_2_decompensation: bool = False


class TimelineVitalItem(BaseModel):
    date: str
    sbp: float
    dbp: float
    bmi: float
    weight: float
    hr: float


class PatientDetailResponse(BaseModel):
    id: str
    patient_id: str
    display_id: str
    display_label: str
    name: str
    age: float
    age_band: str
    gender: str
    sex: str
    race: Optional[str] = None
    ethnicity: Optional[str] = None
    as_of_date: Optional[str] = None
    latest_vitals: VitalSigns
    latest_risk: RiskState
    data_completeness_pct: float
    sparkline_sbp: List[float] = Field(default_factory=list)
    conditions: Any = Field(default_factory=list)
    medications: Any = Field(default_factory=list)
    lifestyle: Optional[Dict[str, Any]] = None
    readings: Optional[List[Dict[str, Any]]] = None
    snapshots: List[SnapshotItem] = Field(default_factory=list)
    timeline_vitals: List[TimelineVitalItem] = Field(default_factory=list)
    feature_row: Optional[Dict[str, Any]] = None
    is_registered: Optional[bool] = False
    is_demo: Optional[bool] = True
    warnings: Optional[List[str]] = Field(default_factory=list)


# ── Prediction & Inference ─────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    patient_id: Optional[str] = None
    features: Optional[Dict[str, Any]] = None


class ContributingFactor(BaseModel):
    feature: str
    label: str
    impact: float
    abs_impact: float
    direction: str  # "increases_risk" or "reduces_risk"
    observed_value: Optional[Any] = None


class PredictResponse(BaseModel):
    patient_id: Optional[str] = None
    raw_score: float
    calibrated_risk: float
    risk_tier: str
    confidence_interval_95: List[float]
    top_contributing_factors: List[ContributingFactor]
    data_completeness: float
    alert_triggered: bool
    caveat: str = (
        "Research prototype on synthetic EHR data. Not a calibrated clinical probability "
        "or diagnostic device. Not for treatment decisions."
    )
    audit: Optional[Dict[str, Any]] = None


# ── What-If Scenario Lab ───────────────────────────────────────────────────────

class WhatIfRequest(BaseModel):
    patient_id: str
    sbp_delta: float = Field(0.0, description="Change in systolic blood pressure in mmHg (range: -30 to +30)")
    weight_change_pct: float = Field(0.0, description="Relative weight change (range: -0.30 to +0.30, i.e. +/-30%)")
    # Compatibility with older frontend field name
    weight_percent: Optional[float] = None


class WhatIfResponse(BaseModel):
    patient_id: str
    baseline_raw: float
    baseline_risk: float
    baseline_tier: str
    scenario_raw: float
    scenario_risk: float
    scenario_tier: str
    delta_risk_pp: float
    delta_raw_pp: float
    features_changed_count: int
    features_changed: List[str]
    sbp_delta_applied: float
    weight_change_pct_applied: float
    is_out_of_distribution: bool
    out_of_distribution_warnings: List[str]
    caveat: str = "Model-based scenario; correlation, not causal treatment advice."
    # Backwards compatibility fields
    baseline_score: Optional[float] = None
    simulated_score: Optional[float] = None
    change_pp: Optional[float] = None
    simulated_tier: Optional[str] = None


# ── Longitudinal Risk Replay ───────────────────────────────────────────────────

class TimelineRiskResponse(BaseModel):
    patient_id: str
    snapshots: List[SnapshotItem]


# ── Global SHAP Importance ────────────────────────────────────────────────────

class GlobalDriverItem(BaseModel):
    rank: int
    feature: str
    display_name: str
    category: str
    relative_importance: float
    clinical_rationale: str


class GlobalExplainResponse(BaseModel):
    title: str
    method: str
    cohort_size: int
    top_features: List[GlobalDriverItem]


# ── Wearable Telemetry ─────────────────────────────────────────────────────────

class WearableRequest(BaseModel):
    patient_id: str
    days: int = 14


class DailyWearableReading(BaseModel):
    date: str
    resting_heart_rate: float
    daily_steps: int
    home_bp_morning: str
    home_bp_evening: str
    home_sbp_mean: float
    home_dbp_mean: float
    sleep_hours: float
    spo2_percent: float
    simulated: bool = True


class WearableSummary(BaseModel):
    avg_resting_hr: float
    avg_daily_steps: int
    avg_home_sbp: float
    avg_home_dbp: float
    avg_sleep_hours: float


class WearableResponse(BaseModel):
    patient_id: str
    simulated: bool = True
    tag: str = "SIMULATED"
    days_count: int
    summary: WearableSummary
    daily_readings: List[DailyWearableReading]
    disclaimer: str


# ── Full Patient Simulator ─────────────────────────────────────────────────────

class SimulateRequest(BaseModel):
    patient_id: str
    sbp_value: Optional[float] = None
    sbp_delta: Optional[float] = None
    dbp_value: Optional[float] = None
    dbp_delta: Optional[float] = None
    hr_value: Optional[float] = None
    hr_delta: Optional[float] = None
    weight_value: Optional[float] = None
    weight_delta_pct: Optional[float] = None
    glucose_value: Optional[float] = None
    glucose_delta: Optional[float] = None
    hba1c_value: Optional[float] = None
    hba1c_delta: Optional[float] = None
    trend: Optional[str] = None  # "improving", "stable", "worsening"
    conditions: Optional[Dict[str, int]] = None
    medications: Optional[Dict[str, int]] = None
    custom_features: Optional[Dict[str, Any]] = None


class SimulateResponse(BaseModel):
    patient_id: str
    baseline_raw: float
    baseline_risk: float
    baseline_tier: str
    scenario_raw: float
    scenario_risk: float
    scenario_tier: str
    delta_risk_pp: float
    delta_raw_pp: float
    tier_changed: bool
    shap_before: List[ContributingFactor]
    shap_after: List[ContributingFactor]
    shap_diff: List[Dict[str, Any]]
    features_changed: List[str]
    warnings: List[str]
    is_out_of_range: bool
    is_low_sensitivity: bool
    sensitivity_message: Optional[str] = None
    caveat: str = (
        "Shows how this model's score reacts to the changed inputs on synthetic data. "
        "It does not predict the effect of a real treatment, and covers hypertension progression only."
    )


# ── Sensitivity Analysis ───────────────────────────────────────────────────────

class SensitivityPoint(BaseModel):
    value: float
    raw_score: float
    calibrated_risk: float
    risk_tier: str


class SensitivityCurve(BaseModel):
    variable: str
    display_name: str
    unit: str
    current_value: float
    points: List[SensitivityPoint]


class SensitivityResponse(BaseModel):
    patient_id: str
    curves: Dict[str, SensitivityCurve]


# ── Wearable Streaming & Live Reading ──────────────────────────────────────────

class StreamReadingRequest(BaseModel):
    patient_id: str
    reading_type: str = "bp"  # "bp", "hr", "spo2", "steps", "all"
    sbp: Optional[float] = None
    dbp: Optional[float] = None
    hr: Optional[float] = None
    spo2: Optional[float] = None
    steps: Optional[int] = None
    timestamp: Optional[str] = None


class StreamReadingResponse(BaseModel):
    patient_id: str
    simulated: bool = True
    reading_accepted: bool = True
    reading_logged: Dict[str, Any]
    wearable_summary: Dict[str, Any]
    alert_flags: List[str]
    updated_vitals: Dict[str, Any]
    updated_risk: Dict[str, Any]
    disclaimer: str = "Simulated wearable telemetry layer — decoupled from ML weights."


# ── Early Warning Alerts ───────────────────────────────────────────────────────

class AlertPatientItem(BaseModel):
    patient_id: str
    display_label: str
    current_risk: float
    previous_risk: float
    risk_rise_pp: float
    risk_tier: str
    first_crossed_date: Optional[str] = None
    lead_time_days: Optional[int] = None
    had_event: bool = False
    alert_reason: str


class AlertsResponse(BaseModel):
    window_snapshots: int
    alert_threshold: float
    flagged_count: int
    patients: List[AlertPatientItem]


# ── ABDM / FHIR Ingestion ──────────────────────────────────────────────────────

class FHIRImportRequest(BaseModel):
    bundle: Dict[str, Any]


class FHIRMappingReport(BaseModel):
    valid: bool
    patient_id: Optional[str] = None
    registered_patient_id: Optional[str] = None
    demographics: Dict[str, Any]
    observations_mapped: int
    conditions_mapped: int
    medications_mapped: int
    features_populated: int
    validation_errors: List[str]
    mapping_summary: List[Dict[str, str]]
    simulated_prediction: Optional[Dict[str, Any]] = None
    registered_twin: Optional[Dict[str, Any]] = None


# ── Audit Integrity ────────────────────────────────────────────────────────────

class AuditVerifyResponse(BaseModel):
    is_valid: bool
    total_entries: int
    tampered_at_index: Optional[int] = None
    first_hash: Optional[str] = None
    last_hash: Optional[str] = None
    message: str


# ── Patient Registration & Dynamic Readings ───────────────────────────────────

class ClinicalReadingInput(BaseModel):
    date: Optional[str] = None
    sbp: float
    dbp: float
    hr: Optional[float] = None
    weight: Optional[float] = None
    bmi: Optional[float] = None
    glucose: Optional[float] = None
    hba1c: Optional[float] = None


class PatientRegisterRequest(BaseModel):
    display_name: Optional[str] = None
    alias: Optional[str] = None
    age: float
    gender: str = "Female"
    race: Optional[str] = "other"
    ethnicity: Optional[str] = "non-hispanic"
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None
    sbp: float
    dbp: float
    heart_rate: Optional[float] = None
    glucose: Optional[float] = None
    hba1c: Optional[float] = None
    readings: Optional[List[ClinicalReadingInput]] = None
    medications: Optional[Dict[str, Any]] = None
    conditions: Optional[Dict[str, Any]] = None
    smoking: Optional[bool] = False
    family_history_hypertension: Optional[bool] = False
    salt_intake: Optional[str] = None  # "low", "normal", "high"
    physical_activity: Optional[str] = None  # "sedentary", "moderate", "active"
    custom_features: Optional[Dict[str, Any]] = None


class PatientRegisterResponse(BaseModel):
    patient_id: str
    display_id: str
    display_label: str
    is_registered: bool = True
    is_demo: bool = False
    as_of_date: str
    latest_vitals: Dict[str, Any]
    calibrated_risk: float
    raw_score: float
    ci_lower: float
    ci_upper: float
    risk_tier: str
    data_completeness_pct: float
    top_contributing_factors: List[ContributingFactor]
    warnings: List[str]
    patient_twin: Dict[str, Any]
    caveat: str = (
        "Research prototype on synthetic data. Shows how the model scores this newly registered profile. "
        "Not a clinical diagnosis or treatment instruction."
    )


class AddReadingRequest(BaseModel):
    date: Optional[str] = None
    sbp: float
    dbp: float
    hr: Optional[float] = None
    weight: Optional[float] = None
    glucose: Optional[float] = None
    hba1c: Optional[float] = None


class AddReadingResponse(BaseModel):
    patient_id: str
    readings_count: int
    latest_vitals: Dict[str, Any]
    updated_risk: Dict[str, Any]
    snapshots: List[Dict[str, Any]]
    warnings: List[str]


class PatientDeleteResponse(BaseModel):
    patient_id: str
    deleted: bool
    message: str



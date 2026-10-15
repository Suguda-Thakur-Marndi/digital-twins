"""
TwinCare / Pramana Clinical Twin — FastAPI Service
Summit: Happiest Health "Reimagining and Reforming Healthcare in India Summit 2026", Bengaluru
Theme: Digital Twin in Healthcare

API Version: v1 (mounted under /api/v1 with root/legacy aliases)
"""

from __future__ import annotations

import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import schemas
from app.services.audit_service import AuditService
from app.services.fhir_service import FHIRService
from app.services.model_service import ModelService
from app.services.patient_service import PatientService
from app.services.shap_service import SHAPService
from app.services.wearable_service import WearableService

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("twincare_api")

# ── Service singletons ────────────────────────────────────────────────────────
_model_svc: Optional[ModelService] = None
_patient_svc: Optional[PatientService] = None
_shap_svc: Optional[SHAPService] = None
_wearable_svc: Optional[WearableService] = None
_audit_svc: Optional[AuditService] = None
_fhir_svc: Optional[FHIRService] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load and verify all required artifacts at startup."""
    global _model_svc, _patient_svc, _shap_svc, _wearable_svc, _audit_svc, _fhir_svc

    logger.info("=== Starting TwinCare / Pramana Clinical Twin Backend ===")

    # Determine artifacts directory
    env_dir = os.getenv("ARTIFACTS_DIR")
    if env_dir:
        artifacts_dir = Path(env_dir)
    elif Path("artifacts").exists():
        artifacts_dir = Path("artifacts")
    elif Path("backend/artifacts").exists():
        artifacts_dir = Path("backend/artifacts")
    else:
        artifacts_dir = Path(__file__).resolve().parent.parent / "artifacts"

    _audit_svc = AuditService()
    _wearable_svc = WearableService()

    # Required artifacts check
    required_files = [
        "feature_schema.json",
        "demo_patients.json",
        "model_metadata.json",
    ]
    missing = [f for f in required_files if not (artifacts_dir / f).exists()]
    if missing:
        err_msg = (
            f"FATAL ERROR: Missing required production artifacts in {artifacts_dir.resolve()}: {missing}\n"
            "Backend cannot start without valid model and patient artifacts."
        )
        logger.critical(err_msg)
        raise RuntimeError(err_msg)

    try:
        logger.info("Loading ModelService...")
        _model_svc = ModelService(artifacts_dir)
        logger.info(
            "ModelService ready: %d features, schema fingerprint=%s",
            _model_svc.feature_count,
            _model_svc.schema_fingerprint,
        )

        logger.info("Loading PatientService...")
        _patient_svc = PatientService(artifacts_dir)
        logger.info("PatientService ready: %d demo patients loaded", _patient_svc.patient_count)

        logger.info("Loading SHAPService...")
        _shap_svc = SHAPService(artifacts_dir, _model_svc)

        logger.info("Loading FHIRService...")
        _fhir_svc = FHIRService(_model_svc, _patient_svc)

        logger.info("=== TwinCare Backend successfully initialized and ready ===")
    except Exception as e:
        logger.critical("Failed to load artifacts: %s", e, exc_info=True)
        raise RuntimeError(f"Startup failure: {e}") from e

    yield
    logger.info("TwinCare Backend shutting down.")


# ── FastAPI App ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="TwinCare / Pramana Clinical Twin API",
    description=(
        "Production-grade FastAPI backend for longitudinal hypertension decompensation "
        "risk prediction and personalized what-if scenario exploration. "
        "Presented at Happiest Health 'Reimagining and Reforming Healthcare in India Summit 2026', Bengaluru. "
        "Research prototype based on Synthea synthetic EHR data. Not for clinical diagnosis or treatment."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS Middleware ───────────────────────────────────────────────────────────
raw_allowed_origins = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ORIGINS")
ALLOWED_ORIGINS = (raw_allowed_origins or "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Dependency helpers ────────────────────────────────────────────────────────
def _require_model() -> ModelService:
    if _model_svc is None:
        raise HTTPException(status_code=503, detail="Model service is currently unavailable.")
    return _model_svc


def _require_patients() -> PatientService:
    if _patient_svc is None:
        raise HTTPException(status_code=503, detail="Patient data service is currently unavailable.")
    return _patient_svc


def _require_shap() -> SHAPService:
    if _shap_svc is None:
        raise HTTPException(status_code=503, detail="SHAP explainability service is currently unavailable.")
    return _shap_svc


def _require_wearable() -> WearableService:
    if _wearable_svc is None:
        raise HTTPException(status_code=503, detail="Wearable simulation service is currently unavailable.")
    return _wearable_svc


# ── Request timing middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info("%s %s -> %s (%.3fs)", request.method, request.url.path, response.status_code, elapsed)
    return response


# ══════════════════════════════════════════════════════════════════════════════
# CORE API /api/v1 ENDPOINTS (AND ALIASES)
# ══════════════════════════════════════════════════════════════════════════════

# 1. Health Check
@app.get("/api/v1/health", response_model=schemas.HealthResponse, tags=["System"])
@app.get("/health", response_model=schemas.HealthResponse, tags=["System"])
@app.get("/api/health", tags=["System"])
async def health_check():
    """Liveness, model version, and schema fingerprint verification."""
    model_loaded = _model_svc is not None
    fp = _model_svc.schema_fingerprint if model_loaded else "unknown"
    return {
        "status": "ok" if model_loaded else "degraded",
        "model_version": _model_svc.model_version if model_loaded else "unknown",
        "schema_fingerprint": fp,
        "schema_hash": fp,
        "feature_count": _model_svc.feature_count if model_loaded else 0,
        "model_loaded": model_loaded,
        "project": "TwinCare",
    }


# 2. Model Info / Metadata
@app.get("/api/v1/model/info", response_model=schemas.ModelInfoResponse, tags=["Model"])
@app.get("/model/info", response_model=schemas.ModelInfoResponse, tags=["Model"])
async def model_info():
    """Complete model specification, metrics with 95% CIs, limitations, and calibration details."""
    model_svc = _require_model()
    meta = model_svc.metadata

    metrics = meta.get("metrics", {})
    calibration = meta.get("calibration", {})
    risk_tiers = meta.get("risk_tiers", {})

    return {
        "model_name": meta.get("model_name", "XGBoost 365-Day Hypertension Decompensation Pipeline"),
        "working_project": meta.get("working_project", "TwinCare"),
        "version": meta.get("version", "1.0.0"),
        "condition": meta.get("condition", "Essential Hypertension"),
        "target_outcome": meta.get("target_outcome", "BP Decompensation within 365 days"),
        "prediction_horizon_days": meta.get("prediction_horizon_days", 365),
        "lookback_history_days": meta.get("lookback_history_days", 365),
        "training_date": meta.get("training_date", "2026-03-15"),
        "schema_fingerprint": model_svc.schema_fingerprint,
        "metrics": {
            "roc_auc": metrics.get("roc_auc", 0.8069),
            "roc_auc_ci_95": metrics.get("roc_auc_ci_95", [0.691, 0.908]),
            "pr_auc": metrics.get("pr_auc", 0.0644),
            "base_rate": metrics.get("base_rate", 0.01457),
            "total_supervised_rows": metrics.get("total_supervised_rows", 6451),
            "total_patients": metrics.get("total_patients", 1335),
            "positive_events_total": metrics.get("positive_events_total", 94),
            "positive_events_test": metrics.get("positive_events_test", 14),
        },
        "calibration": {
            "method": calibration.get("method", "Platt Scaling"),
            "calibrator_coef": calibration.get("calibrator_coef", 0.4393),
            "calibrator_intercept": calibration.get("calibrator_intercept", -2.2073),
            "uncalibrated_warning": calibration.get("uncalibrated_warning", "Raw scores reflect ranking; use calibrated risk."),
        },
        "risk_tiers": risk_tiers,
        "alert_threshold": meta.get("alert_threshold", 0.40),
        "validation_threshold": meta.get("validation_threshold", 0.7562),
        "data_source": meta.get("data_source", "Synthea Synthetic EHR"),
        "limitations": meta.get("limitations", []),
        "disclaimer": (
            "Research prototype on synthetic data. Not a certified medical device. "
            "Not for clinical diagnosis or treatment decisions."
        ),
    }


# 3. Patient List
@app.get("/api/v1/patients", response_model=List[schemas.PatientSummaryItem], tags=["Patients"])
@app.get("/patients", response_model=List[schemas.PatientSummaryItem], tags=["Patients"])
@app.get("/api/patients", tags=["Patients"])
async def list_patients(limit: int = 100):
    """Dense list of demo patients for directory table and selector."""
    patient_svc = _require_patients()
    limit = min(max(1, limit), 200)
    return patient_svc.list_patients(limit=limit)


# 4. Patient Detail (Twin State)
@app.get("/api/v1/patients/{patient_id}", response_model=schemas.PatientDetailResponse, tags=["Patients"])
@app.get("/patients/{patient_id}", response_model=schemas.PatientDetailResponse, tags=["Patients"])
@app.get("/api/patients/{patient_id}", tags=["Patients"])
async def get_patient_detail(patient_id: str):
    """Full digital twin state: demographics, vitals, timelines, conditions, medications."""
    patient_svc = _require_patients()
    patient = patient_svc.get_patient(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return patient


# 4b. Patient Registration
@app.post("/api/v1/patients/register", response_model=schemas.PatientRegisterResponse, tags=["Patients"])
@app.post("/api/patients/register", response_model=schemas.PatientRegisterResponse, tags=["Patients"])
async def register_patient(request: schemas.PatientRegisterRequest):
    """
    Creates a new synthetic patient record with generated ID, derives full 132-feature row,
    validates physiological ranges, computes data completeness, runs model inference + SHAP,
    persists to backend/data/registered_patients.json, and appends a hash-chained audit event.
    """
    model_svc = _require_model()
    patient_svc = _require_patients()
    shap_svc = _require_shap()
    audit_svc = _audit_svc

    try:
        res = patient_svc.register_patient(
            request.model_dump(),
            model_svc=model_svc,
            shap_svc=shap_svc,
            audit_svc=audit_svc,
        )
        return res
    except ValueError as e:
        err_str = str(e)
        try:
            field_errs = json.loads(err_str)
            if isinstance(field_errs, dict):
                return JSONResponse(
                    status_code=422,
                    content={"detail": "Clinical input validation failed", "field_errors": field_errs},
                )
        except json.JSONDecodeError:
            pass
        return JSONResponse(
            status_code=422,
            content={"detail": err_str, "field_errors": {"general": err_str}},
        )
    except Exception as e:
        logger.error("Failed to register patient: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Registration error: {e}")


# 4c. Add Reading to Patient
@app.post("/api/v1/patients/{patient_id}/readings", response_model=schemas.AddReadingResponse, tags=["Patients"])
@app.post("/api/patients/{patient_id}/readings", response_model=schemas.AddReadingResponse, tags=["Patients"])
async def add_patient_reading(patient_id: str, request: schemas.AddReadingRequest):
    """
    Add a new blood pressure reading / vitals to an existing patient.
    Re-derives feature vector, recalculates calibrated risk, appends snapshot,
    updates persistence store (if registered patient), and logs to audit trail.
    """
    model_svc = _require_model()
    patient_svc = _require_patients()
    audit_svc = _audit_svc

    try:
        res = patient_svc.add_reading(
            patient_id=patient_id,
            reading_data=request.model_dump(),
            model_svc=model_svc,
            audit_svc=audit_svc,
        )
        return res
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Failed to add reading: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add reading: {e}")


# 4d. Delete Registered Patient
@app.delete("/api/v1/patients/{patient_id}", response_model=schemas.PatientDeleteResponse, tags=["Patients"])
@app.delete("/api/patients/{patient_id}", response_model=schemas.PatientDeleteResponse, tags=["Patients"])
async def delete_patient(patient_id: str):
    """
    Delete a registered synthetic patient record.
    Built-in demo patients cannot be deleted.
    Logs deletion event to tamper-evident audit log.
    """
    patient_svc = _require_patients()
    audit_svc = _audit_svc

    try:
        patient_svc.delete_patient(patient_id=patient_id, audit_svc=audit_svc)
        return {
            "patient_id": patient_id,
            "deleted": True,
            "message": f"Successfully deleted registered patient '{patient_id}'.",
        }
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error("Failed to delete patient: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete patient: {e}")


# 4e. FHIR Bundle Import Patient
@app.post("/api/v1/patients/import-fhir", response_model=schemas.FHIRMappingReport, tags=["Patients"])
@app.post("/api/patients/import-fhir", response_model=schemas.FHIRMappingReport, tags=["Patients"])
async def import_fhir_patient(request: schemas.FHIRImportRequest):
    """
    Import an ABDM-aligned FHIR R4 Bundle as an alternative registration path.
    Maps clinical observations and registers the synthetic patient in the system.
    """
    if _fhir_svc is None:
        raise HTTPException(status_code=503, detail="FHIR ingestion service unavailable.")
    return _fhir_svc.parse_and_map_bundle(
        bundle=request.bundle,
        register=True,
        shap_svc=_shap_svc,
        audit_svc=_audit_svc,
    )


# 5. Predict Endpoint
@app.post("/api/v1/predict", response_model=schemas.PredictResponse, tags=["Inference"])
@app.post("/predict", response_model=schemas.PredictResponse, tags=["Inference"])
@app.post("/api/predict", tags=["Inference"])
async def predict_risk(request: schemas.PredictRequest):
    """
    Predict 1-year hypertension decompensation risk.
    Accepts patient_id OR raw feature dictionary.
    Returns raw score, calibrated risk, risk tier, signed SHAP factors, data completeness, and audit metadata.
    """
    model_svc = _require_model()
    patient_svc = _require_patients()
    shap_svc = _require_shap()

    if request.patient_id:
        x_df = patient_svc.get_feature_row(request.patient_id)
        if x_df is None:
            raise HTTPException(status_code=404, detail=f"Patient '{request.patient_id}' not found.")
    elif request.features:
        try:
            x_df = pd.DataFrame([request.features])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid feature dictionary: {e}")
    else:
        raise HTTPException(status_code=400, detail="Must provide either 'patient_id' or 'features'.")

    try:
        pred_res = model_svc.predict(x_df, context="predict")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Log to audit log
    if _audit_svc and "audit" in pred_res:
        _audit_svc.log(pred_res["audit"])

    # Compute top contributing factors
    factors = shap_svc.explain(x_df, n_drivers=6)

    return {
        "patient_id": request.patient_id,
        "raw_score": pred_res["raw_score"],
        "calibrated_risk": pred_res["calibrated_risk"],
        "risk_tier": pred_res["risk_tier"],
        "confidence_interval_95": pred_res["confidence_interval_95"],
        "top_contributing_factors": factors,
        "data_completeness": pred_res["data_completeness_pct"],
        "alert_triggered": pred_res["alert_triggered"],
        "caveat": (
            "Research prototype on synthetic EHR data. Not a calibrated clinical probability "
            "or diagnostic device. Not for treatment decisions."
        ),
        "audit": pred_res.get("audit"),
        # Legacy compat
        "risk_score": pred_res["raw_score"],
    }


# 6. What-If Counterfactual Lab
@app.post("/api/v1/whatif", response_model=schemas.WhatIfResponse, tags=["Simulation"])
@app.post("/whatif", response_model=schemas.WhatIfResponse, tags=["Simulation"])
@app.post("/api/what-if", tags=["Simulation"])
async def whatif_simulation(request: schemas.WhatIfRequest):
    """
    Personalized what-if counterfactual scenario exploration.
    Consistently shifts all correlated SBP, weight, and BMI columns and recomputes pulse pressure.
    Returns baseline vs scenario risk, delta in percentage points, and distribution warnings.
    """
    model_svc = _require_model()
    patient_svc = _require_patients()

    x_df = patient_svc.get_feature_row(request.patient_id)
    if x_df is None:
        raise HTTPException(status_code=404, detail=f"Patient '{request.patient_id}' not found.")

    wt_pct = request.weight_change_pct
    if request.weight_percent is not None:
        wt_pct = request.weight_percent

    try:
        sim_res = model_svc.what_if(
            x_df,
            sbp_delta=request.sbp_delta,
            weight_change_pct=wt_pct,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "patient_id": request.patient_id,
        "baseline_raw": sim_res["baseline_raw"],
        "baseline_risk": sim_res["baseline_risk"],
        "baseline_tier": sim_res["baseline_tier"],
        "scenario_raw": sim_res["scenario_raw"],
        "scenario_risk": sim_res["scenario_risk"],
        "scenario_tier": sim_res["scenario_tier"],
        "delta_risk_pp": sim_res["delta_risk_pp"],
        "delta_raw_pp": sim_res["delta_raw_pp"],
        "features_changed_count": sim_res["features_changed_count"],
        "features_changed": sim_res["features_changed"],
        "sbp_delta_applied": sim_res["sbp_delta_applied"],
        "weight_change_pct_applied": sim_res["weight_change_pct_applied"],
        "is_out_of_distribution": sim_res["is_out_of_distribution"],
        "out_of_distribution_warnings": sim_res["out_of_distribution_warnings"],
        "caveat": sim_res["caveat"],
        # Legacy compatibility fields
        "baseline_score": sim_res["baseline_raw"],
        "simulated_score": sim_res["scenario_raw"],
        "change_pp": sim_res["delta_raw_pp"],
        "simulated_tier": sim_res["scenario_tier"],
    }


# 6b. Full Patient Simulator
@app.post("/api/v1/simulate", response_model=schemas.SimulateResponse, tags=["Simulation"])
@app.post("/api/simulate", response_model=schemas.SimulateResponse, tags=["Simulation"])
async def simulate_patient(request: schemas.SimulateRequest):
    """
    Full Clinical Patient Simulator:
    - Grouped input editor for SBP, DBP, HR, Weight, Glucose, HbA1c, trend, conditions & meds.
    - Uses lever_map.json so all correlated features shift consistently.
    - Computes real baseline vs scenario risk, tier transition, and directional SHAP diff.
    - Clamps to training distribution and detects low-sensitivity plateaus.
    """
    model_svc = _require_model()
    patient_svc = _require_patients()
    shap_svc = _require_shap()

    x_df = patient_svc.get_feature_row(request.patient_id)
    if x_df is None:
        raise HTTPException(status_code=404, detail=f"Patient '{request.patient_id}' not found.")

    x_df = x_df.copy()
    x_df.attrs["patient_id"] = request.patient_id
    x_df.loc[0, "patient_id"] = request.patient_id
    x_df.loc[0, "id"] = request.patient_id

    # Preserve the original patient identity in the model input while allowing
    # validation to reject these metadata columns from the actual feature set.
    x_df = x_df.drop(columns=["patient_id", "id"], errors="ignore")
    x_df.attrs["patient_id"] = request.patient_id

    levers_dict = {
        k: v for k, v in request.model_dump(exclude_unset=True).items() if k != "patient_id"
    }
    try:
        sim_res = model_svc.simulate(x_df, levers=levers_dict, shap_svc=shap_svc)
        sim_res["patient_id"] = request.patient_id
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Log simulation to audit log if modified
    if _audit_svc and sim_res.get("features_changed"):
        from datetime import datetime
        _audit_svc.log({
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "model_version": model_svc.model_version,
            "schema_fingerprint": model_svc.schema_fingerprint,
            "input_hash": f"sim-{request.patient_id[:8]}",
            "score": sim_res["scenario_raw"],
            "calibrated_risk": sim_res["scenario_risk"],
            "risk_tier": sim_res["scenario_tier"],
            "context": "simulate",
        })

    return sim_res


# 6c. Patient Sensitivity Curves
@app.get("/api/v1/patients/{patient_id}/sensitivity", response_model=schemas.SensitivityResponse, tags=["Simulation"])
@app.get("/api/patients/{patient_id}/sensitivity", response_model=schemas.SensitivityResponse, tags=["Simulation"])
async def get_patient_sensitivity(patient_id: str):
    """
    Multi-point sensitivity curves per primary variable for a specific patient.
    Visualizes step-function plateaus of the underlying tree models.
    """
    model_svc = _require_model()
    patient_svc = _require_patients()

    x_df = patient_svc.get_feature_row(patient_id)
    if x_df is None:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    try:
        return model_svc.get_sensitivity(x_df, patient_id)
    except Exception as e:
        logger.error("Error generating sensitivity curves: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate sensitivity analysis: {e}")



# 7. Longitudinal Risk Replay
@app.get("/api/v1/patients/{patient_id}/timeline-risk", response_model=schemas.TimelineRiskResponse, tags=["Timeline"])
@app.get("/patients/{patient_id}/timeline-risk", response_model=schemas.TimelineRiskResponse, tags=["Timeline"])
@app.get("/api/patients/{patient_id}/timeline", tags=["Timeline"])
async def get_patient_timeline_risk(patient_id: str):
    """Historical snapshots with risk scores and vitals for the risk-over-time replay scrubber."""
    patient_svc = _require_patients()
    snapshots = patient_svc.get_timeline_risk(patient_id)
    if snapshots is None:
        raise HTTPException(status_code=404, detail=f"Timeline for patient '{patient_id}' not found.")
    return {
        "patient_id": patient_id,
        "snapshots": snapshots,
    }


# 7b. Early Warning Risk Alerts
@app.get("/api/v1/alerts", response_model=schemas.AlertsResponse, tags=["Timeline"])
@app.get("/api/alerts", response_model=schemas.AlertsResponse, tags=["Timeline"])
async def get_risk_alerts(
    window: int = Query(3, ge=2, le=10, description="Window of recent snapshots to evaluate for risk rise"),
    threshold: float = Query(0.05, ge=0.01, le=0.50, description="Alert threshold for calibrated risk"),
):
    """
    Early warning alert surveillance: patients whose risk rose over the last N snapshots
    or crossed the alert threshold, with lead time calculation before decompensation events.
    """
    patient_svc = _require_patients()
    return patient_svc.get_alerts(window=window, threshold=threshold)


# 8. Global SHAP Explainability
@app.get("/api/v1/explain/global", response_model=schemas.GlobalExplainResponse, tags=["Explainability"])
@app.get("/explain/global", response_model=schemas.GlobalExplainResponse, tags=["Explainability"])
async def get_global_explainability():
    """Global longitudinal feature importances across the training cohort."""
    model_svc = _require_model()
    return model_svc.global_shap


# 9. Simulated Wearable Telemetry
@app.post("/api/v1/simulate/wearable", response_model=schemas.WearableResponse, tags=["Wearables"])
@app.post("/simulate/wearable", response_model=schemas.WearableResponse, tags=["Wearables"])
async def simulate_wearable(request: schemas.WearableRequest):
    """
    Deterministic simulated wearable stream (daily resting HR, steps, home BP, sleep, SpO2).
    Seeded reproducibly by patient_id. Explicitly tagged with simulated: true.
    """
    patient_svc = _require_patients()
    wearable_svc = _require_wearable()

    patient = patient_svc.get_patient(request.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient '{request.patient_id}' not found.")

    vitals = patient.get("latest_vitals", {})
    return wearable_svc.simulate_feed(
        patient_id=request.patient_id,
        baseline_hr=vitals.get("hr", 72.0),
        baseline_sbp=vitals.get("sbp", 125.0),
        baseline_dbp=vitals.get("dbp", 82.0),
        days=min(max(3, request.days), 30),
    )


# 9b. Ingest Live Telemetry Reading
@app.post("/api/v1/stream/reading", response_model=schemas.StreamReadingResponse, tags=["Wearables"])
@app.post("/api/stream/reading", response_model=schemas.StreamReadingResponse, tags=["Wearables"])
async def stream_reading(request: schemas.StreamReadingRequest):
    """
    Ingest a live telemetry reading (from Bluetooth cuff or wearable feed).
    Updates patient stream, evaluates alert rule engine, and broadcasts to active SSE listeners.
    Decoupled from ML weights.
    """
    patient_svc = _require_patients()
    wearable_svc = _require_wearable()
    model_svc = _require_model()

    patient = patient_svc.get_patient(request.patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient '{request.patient_id}' not found.")

    res = wearable_svc.add_stream_reading(
        patient_id=request.patient_id,
        sbp=request.sbp,
        dbp=request.dbp,
        hr=request.hr,
        spo2=request.spo2,
        steps=request.steps,
        reading_type=request.reading_type,
    )

    # Optionally recompute calibrated risk if systolic & diastolic are provided
    x_df = patient_svc.get_feature_row(request.patient_id)
    if x_df is not None and request.sbp is not None:
        try:
            curr_sbp = float(x_df.iloc[0].get("sbp_latest", 125.0))
            delta = request.sbp - curr_sbp
            sim_res = model_svc.simulate(x_df, {"sbp_delta": delta}, shap_svc=None)
            res["updated_risk"] = {
                "calibrated_risk": sim_res["scenario_risk"],
                "raw_score": sim_res["scenario_raw"],
                "risk_tier": sim_res["scenario_tier"],
                "delta_pp": sim_res["delta_risk_pp"],
            }
        except Exception:
            res["updated_risk"] = {"calibrated_risk": 0.0, "risk_tier": "Unchanged"}
    else:
        res["updated_risk"] = {"calibrated_risk": 0.0, "risk_tier": "Unchanged"}

    return res


# 9c. SSE Live Telemetry Stream
@app.get("/api/v1/stream/{patient_id}", tags=["Wearables"])
async def sse_patient_stream(patient_id: str):
    """
    Server-Sent Events (SSE) live telemetry feed for dynamic digital twin updates.
    Broadcasts newly ingested readings in real time.
    """
    import asyncio
    from fastapi.responses import StreamingResponse

    wearable_svc = _require_wearable()
    q = wearable_svc.subscribe(patient_id)

    async def event_generator():
        try:
            while True:
                try:
                    reading = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(reading)}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            wearable_svc.unsubscribe(patient_id, q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )



# 10. Audit Log & Hash-Chain Verification Endpoint
@app.get("/api/v1/audit", tags=["Audit"])
@app.get("/api/audit", tags=["Audit"])
async def get_audit_log(limit: int = 50):
    """Tamper-evident inference audit log with cryptographic hash-chaining."""
    if _audit_svc is None:
        raise HTTPException(status_code=503, detail="Audit service unavailable.")
    return {"entries": _audit_svc.get_log(limit=limit)}


@app.get("/api/v1/audit/verify", response_model=schemas.AuditVerifyResponse, tags=["Audit"])
@app.get("/api/audit/verify", response_model=schemas.AuditVerifyResponse, tags=["Audit"])
async def verify_audit_log():
    """Verify cryptographic SHA-256 hash-chain integrity across all stored log entries."""
    if _audit_svc is None:
        raise HTTPException(status_code=503, detail="Audit service unavailable.")
    return _audit_svc.verify_integrity()


# 10b. ABDM / FHIR Ingestion Endpoint
@app.post("/api/v1/import/fhir", response_model=schemas.FHIRMappingReport, tags=["ABDM/FHIR"])
@app.post("/api/import/fhir", response_model=schemas.FHIRMappingReport, tags=["ABDM/FHIR"])
async def import_fhir_bundle(request: schemas.FHIRImportRequest):
    """
    Ingest an ABDM-aligned FHIR R4 Bundle JSON (Patient, Observation, Condition, MedicationStatement).
    Validates structure, maps to the model feature schema, and runs inference.
    """
    if _fhir_svc is None:
        raise HTTPException(status_code=503, detail="FHIR ingestion service unavailable.")
    return _fhir_svc.parse_and_map_bundle(request.bundle)


# 11. Legacy SHAP endpoint for compatibility
@app.post("/api/shap", tags=["Explainability"])
async def legacy_shap(request: Dict[str, Any]):
    patient_id = request.get("patient_id")
    n_drivers = request.get("n_drivers", 6)
    if not patient_id:
        raise HTTPException(status_code=400, detail="Missing patient_id")
    patient_svc = _require_patients()
    shap_svc = _require_shap()
    x_df = patient_svc.get_feature_row(patient_id)
    if x_df is None:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    drivers = shap_svc.explain(x_df, n_drivers=n_drivers)
    return {
        "patient_id": patient_id,
        "drivers": drivers,
        "note": "SHAP explains model inputs; does not establish medical causation.",
    }


# 12. Legacy Metadata and Performance endpoints for compatibility
@app.get("/api/model/metadata", tags=["Model"])
async def legacy_model_metadata():
    model_svc = _require_model()
    meta = model_svc.metadata
    metrics = meta.get("metrics", {})
    return {
        "model": meta.get("model_name", "XGBoost Pipeline"),
        "prediction_target": meta.get("target_outcome", "365-day hypertension decompensation"),
        "lookback_days": 365,
        "prediction_horizon_days": 365,
        "roc_auc": metrics.get("roc_auc", 0.8069),
        "roc_auc_ci": metrics.get("roc_auc_ci_95", [0.691, 0.908]),
        "pr_auc": metrics.get("pr_auc", 0.0644),
        "event_rate": metrics.get("base_rate", 0.01457),
        "positive_cases": metrics.get("positive_events_total", 94),
        "total_rows": metrics.get("total_supervised_rows", 6451),
        "test_positives": metrics.get("test_positives", 14),
        "validation_threshold": meta.get("validation_threshold", 0.7562),
        "synthetic_data": True,
        "clinical_validation": False,
        "schema_hash": model_svc.schema_fingerprint,
        "model_hash": meta.get("model_hash", "8d798b1c6e042e83"),
        "feature_count": model_svc.feature_count,
    }


@app.get("/api/v1/model/performance", tags=["Model"])
@app.get("/api/model/performance", tags=["Model"])
async def get_model_performance():
    """
    Transparent performance audit: held-out test evaluation, calibration reliability curve,
    alert-budget operating trade-offs, and failure analysis of static thresholding.
    """
    model_svc = _require_model()
    meta = model_svc.metadata
    metrics = meta.get("metrics", {})

    # Calibration reliability curve points (quantile bins on held-out test cohort)
    calibration_curve_points = [
        {"bin": 1, "predicted_risk": 0.0991, "observed_fraction": 0.0000, "sample_count": 193},
        {"bin": 2, "predicted_risk": 0.0991, "observed_fraction": 0.0052, "sample_count": 193},
        {"bin": 3, "predicted_risk": 0.0992, "observed_fraction": 0.0052, "sample_count": 193},
        {"bin": 4, "predicted_risk": 0.0994, "observed_fraction": 0.0104, "sample_count": 192},
        {"bin": 5, "predicted_risk": 0.1025, "observed_fraction": 0.0518, "sample_count": 193},
    ]

    # Alert-budget operating policy table (top 5%, 10%, 20% screening thresholds)
    alert_budget = [
        {
            "tier": "Top 5% Alert Budget",
            "percent_flagged": 5.0,
            "patients_flagged": 48,
            "raw_threshold": 0.0966,
            "calibrated_threshold": 0.1029,
            "true_positives": 4,
            "false_positives": 44,
            "precision": 0.083,
            "precision_ci_95": [0.005, 0.162],
            "recall": 0.286,
            "recall_ci_95": [0.049, 0.522],
            "clinical_interpretation": "High-specificity alert tier; captures nearly 30% of events flagging 1 in 20 patients.",
        },
        {
            "tier": "Top 10% Alert Budget",
            "percent_flagged": 10.0,
            "patients_flagged": 96,
            "raw_threshold": 0.0418,
            "calibrated_threshold": 0.1007,
            "true_positives": 6,
            "false_positives": 90,
            "precision": 0.062,
            "precision_ci_95": [0.014, 0.111],
            "recall": 0.429,
            "recall_ci_95": [0.169, 0.688],
            "clinical_interpretation": "Recommended operational surveillance cutoff; captures 42.9% of decompensations.",
        },
        {
            "tier": "Top 20% Alert Budget",
            "percent_flagged": 20.0,
            "patients_flagged": 192,
            "raw_threshold": 0.0133,
            "calibrated_threshold": 0.0996,
            "true_positives": 10,
            "false_positives": 182,
            "precision": 0.052,
            "precision_ci_95": [0.021, 0.084],
            "recall": 0.714,
            "recall_ci_95": [0.478, 0.951],
            "clinical_interpretation": "Broad community screening tier; captures >71% of events with manageable review load.",
        },
    ]

    return {
        "roc_auc": metrics.get("roc_auc", 0.8069),
        "roc_auc_ci": metrics.get("roc_auc_ci_95", [0.691, 0.908]),
        "pr_auc": metrics.get("pr_auc", 0.0644),
        "event_rate": metrics.get("base_rate", 0.01457),
        "positive_cases": metrics.get("positive_events_total", 94),
        "total_rows": metrics.get("total_supervised_rows", 6451),
        "test_positives": metrics.get("test_positives", 14),
        "test_negatives": 950,
        "validation_threshold": meta.get("validation_threshold", 0.7562),
        "threshold_tp": 0,
        "threshold_fp": 0,
        "threshold_fn": 14,
        "threshold_tn": 950,
        "honest_threshold_statement": (
            "The static validation threshold of 0.7562 flagged none of the 14 test positives (0% recall). "
            "Because test PR-AUC is 0.064 against a low base rate of 1.46% with very few test events, "
            "binary decision thresholds must be replaced by alert-budget percentile policies."
        ),
        "calibration_curve": calibration_curve_points,
        "alert_budget_table": alert_budget,
        "limitations": meta.get("limitations", []),
        "disclaimer": "Synthetic data. Research prototype. Not medical advice.",
    }


# 13. Population endpoint
@app.get("/api/population", tags=["Population"])
async def population_cohort():
    patient_svc = _require_patients()
    patients = patient_svc.list_patients(limit=100)
    return {
        "data": patients,
        "disclaimer": "Synthetic population — research demonstration only.",
        "total": len(patients),
    }


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check backend logs for trace."},
    )

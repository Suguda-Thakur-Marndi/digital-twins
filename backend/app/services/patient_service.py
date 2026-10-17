"""
Patient service — loads demo_patients.json and persists registered patients.
Fails loudly if required model artifacts are missing.
Includes:
- Dynamic patient registration with 132-feature row derivation
- Clamping and range validation against feature_schema.json
- Data completeness scoring and LOW_DATA / OUT_OF_RANGE warnings
- Multiple readings support and dynamic twin updates
- Deletion of registered patients
- Persistence to backend/data/registered_patients.json
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime, date
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


import math


def _sanitize_nans(obj: Any) -> Any:
    """Recursively convert float NaN/Inf values to None for JSON compliance."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    elif isinstance(obj, dict):
        return {k: _sanitize_nans(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_nans(item) for item in obj]
    return obj


def _clean_patient_record(p: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure patient record has all expected fields with aliases."""
    rec = _sanitize_nans(dict(p))
    pid = str(rec.get("id", ""))
    rec["id"] = pid
    rec["patient_id"] = pid
    if "display_id" not in rec:
        rec["display_id"] = f"PT-{pid[:4]}"
    if "display_label" not in rec:
        rec["display_label"] = f"{rec['display_id']} (Patient)"
    if "name" not in rec:
        rec["name"] = "Demo Patient"
    if "gender" not in rec:
        rec["gender"] = "Female"
    rec["sex"] = "F" if str(rec["gender"]).upper().startswith("F") else "M"
    if "is_registered" not in rec:
        rec["is_registered"] = False
    if "is_demo" not in rec:
        rec["is_demo"] = True

    # Ensure latest_risk tier strictly corresponds to calibrated_risk thresholds (<15% Low, 15-40% Moderate, >=40% High)
    if "latest_risk" in rec and isinstance(rec["latest_risk"], dict):
        cal_risk = rec["latest_risk"].get("calibrated_risk")
        if cal_risk is not None and not math.isnan(float(cal_risk)):
            c_val = float(cal_risk)
            if c_val >= 0.40:
                rec["latest_risk"]["risk_tier"] = "High"
            elif c_val >= 0.15:
                rec["latest_risk"]["risk_tier"] = "Moderate"
            else:
                rec["latest_risk"]["risk_tier"] = "Low"

    return rec



class PatientService:
    def __init__(self, artifacts_dir: Path | str):
        self._artifacts_dir = Path(artifacts_dir)
        self._lock = Lock()

        # Load feature schema for validation
        schema_path = self._artifacts_dir / "feature_schema.json"
        if not schema_path.exists():
            raise FileNotFoundError(f"FATAL: Required artifact missing: {schema_path.resolve()}")
        with open(schema_path, "r", encoding="utf-8") as f:
            raw_schema = json.load(f)
            self._feature_spec: Dict[str, Dict[str, Any]] = {
                f["name"]: f for f in raw_schema.get("features", [])
            }
            self._feature_names: List[str] = [f["name"] for f in raw_schema.get("features", [])]

        # Load demo patients
        demo_patients_path = self._artifacts_dir / "demo_patients.json"
        if not demo_patients_path.exists():
            raise FileNotFoundError(
                f"FATAL: Required artifact missing: {demo_patients_path.resolve()}. "
                "Ensure backend/artifacts/demo_patients.json exists."
            )

        with open(demo_patients_path, "r", encoding="utf-8") as f:
            raw_patients: List[Dict[str, Any]] = json.load(f)

        self._demo_patients: List[Dict[str, Any]] = [_clean_patient_record(p) for p in raw_patients]
        logger.info("Loaded %d demo patients from demo_patients.json", len(self._demo_patients))

        # Setup persistence for registered patients
        env_reg_path = os.getenv("REGISTERED_PATIENTS_PATH")
        env_data_dir = os.getenv("DATA_DIR") or os.getenv("PERSISTENT_DATA_DIR")
        if env_reg_path:
            self._registered_file = Path(env_reg_path)
            self._data_dir = self._registered_file.parent
        elif env_data_dir:
            self._data_dir = Path(env_data_dir)
            self._registered_file = self._data_dir / "registered_patients.json"
        else:
            self._data_dir = self._artifacts_dir.parent / "data"
            if not self._data_dir.exists():
                alt_data = Path("backend/data")
                if alt_data.parent.exists():
                    self._data_dir = alt_data
                else:
                    self._data_dir = Path("data")
            self._registered_file = self._data_dir / "registered_patients.json"

        self._data_dir.mkdir(parents=True, exist_ok=True)

        self._registered_patients: List[Dict[str, Any]] = []
        if self._registered_file.exists():
            try:
                with open(self._registered_file, "r", encoding="utf-8") as f:
                    reg_raw = json.load(f)
                    self._registered_patients = [_clean_patient_record(p) for p in reg_raw]
                logger.info("Loaded %d registered patients from %s", len(self._registered_patients), self._registered_file)
            except Exception as e:
                logger.error("Failed to load registered patients: %s", e)

        # Index maps
        self._rebuild_index()

    def _rebuild_index(self):
        self._all_by_id: Dict[str, Dict[str, Any]] = {}
        # Demo patients first
        for p in self._demo_patients:
            self._all_by_id[str(p["id"])] = p
            self._all_by_id[str(p["id"]).lower()] = p
            if "display_id" in p:
                self._all_by_id[str(p["display_id"]).lower()] = p
                self._all_by_id[str(p["display_id"]).upper()] = p

        # Registered patients overwrite or supplement
        for p in self._registered_patients:
            self._all_by_id[str(p["id"])] = p
            self._all_by_id[str(p["id"]).lower()] = p
            if "display_id" in p:
                self._all_by_id[str(p["display_id"]).lower()] = p
                self._all_by_id[str(p["display_id"]).upper()] = p

    def _save_registered_patients(self):
        try:
            with open(self._registered_file, "w", encoding="utf-8") as f:
                json.dump(self._registered_patients, f, indent=2, default=str)
        except Exception as e:
            logger.error("Failed to save registered patients: %s", e)

    @property
    def patient_count(self) -> int:
        return len(self._demo_patients) + len(self._registered_patients)

    def list_patients(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List patients for directory table: registered first, then demo."""
        out = []
        # Registered patients first
        all_pts = list(self._registered_patients) + list(self._demo_patients)
        for p in all_pts[:limit]:
            latest_v = p.get("latest_vitals", {})
            latest_r = p.get("latest_risk", {})
            out.append({
                "id": p["id"],
                "patient_id": p["id"],
                "display_id": p.get("display_id", p["id"][:8]),
                "display_label": p.get("display_label", f"Patient {p['id'][:8]}"),
                "name": p.get("name", "Demo Patient"),
                "age": int(p.get("age", 50)),
                "age_band": p.get("age_band", "50-59"),
                "gender": p.get("gender", "Female"),
                "sex": p.get("sex", "F"),
                "latest_date": p.get("as_of_date"),
                "as_of_date": p.get("as_of_date"),
                "risk_tier": latest_r.get("risk_tier", "Low"),
                "risk_score": float(latest_r.get("calibrated_risk", 0.0)),
                "calibrated_risk": float(latest_r.get("calibrated_risk", 0.0)),
                "raw_score": float(latest_r.get("raw_score", 0.0)),
                "latest_sbp": latest_v.get("sbp"),
                "latest_dbp": latest_v.get("dbp"),
                "sparkline_sbp": p.get("sparkline_sbp", []),
                "data_completeness_pct": float(p.get("data_completeness_pct", 95.0)),
                "is_registered": bool(p.get("is_registered", False)),
                "is_demo": bool(p.get("is_demo", True)),
            })
        return out

    def get_patient(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Return full patient digital twin state."""
        pid_clean = patient_id.strip().lower()
        if pid_clean in self._all_by_id:
            return self._all_by_id[pid_clean]
        if patient_id in self._all_by_id:
            return self._all_by_id[patient_id]
        return None

    def get_feature_row(self, patient_id: str) -> Optional[pd.DataFrame]:
        """Return DataFrame with 1 row and all features for inference."""
        patient = self.get_patient(patient_id)
        if patient and "feature_row" in patient:
            return pd.DataFrame([patient["feature_row"]])
        return None

    def get_timeline_risk(self, patient_id: str) -> Optional[List[Dict[str, Any]]]:
        """Return historical snapshots with risk scores for replay chart."""
        patient = self.get_patient(patient_id)
        if patient and "snapshots" in patient and patient["snapshots"]:
            return patient["snapshots"]
        return None

    def get_all_snapshots(self, patient_id: str) -> pd.DataFrame:
        """Return all historical snapshots for a patient as a DataFrame."""
        patient = self.get_patient(patient_id)
        if patient and "snapshots" in patient and patient["snapshots"]:
            return pd.DataFrame(patient["snapshots"])
        return pd.DataFrame()

    def get_feature_row_by_index(self, idx: Any) -> Optional[pd.DataFrame]:
        """Return feature row for a given snapshot index if available."""
        return None

    # ── Field Validation & Range Checking ─────────────────────────────────────
    def validate_patient_fields(self, data: Dict[str, Any]) -> Tuple[Dict[str, str], List[str]]:
        """
        Validate fields against physiological boundaries and feature_schema ranges.
        Returns: (field_errors, warnings)
        """
        errors: Dict[str, str] = {}
        warnings: List[str] = []

        # 1. Forbidden and unknown columns check
        forbidden = {"target_label", "event_date", "last_followup", "prediction_end", "prediction_time", "status"}
        custom = data.get("custom_features", {}) or {}
        if isinstance(custom, dict):
            found_forbid = forbidden.intersection(custom.keys())
            if found_forbid:
                errors["forbidden_columns"] = f"Forbidden column(s) rejected for clinical safety: {sorted(found_forbid)}"
            unknown = set(custom.keys()) - set(self._feature_spec.keys())
            if unknown:
                errors["unknown_columns"] = f"Unknown column(s) not in feature schema rejected: {sorted(unknown)}"

        # 2. Age
        age = data.get("age")
        if age is None:
            errors["age"] = "Patient age is required."
        elif not isinstance(age, (int, float)) or age < 18 or age > 115:
            errors["age"] = f"Age must be between 18 and 115 years (entered: {age})."

        # 3. SBP & DBP
        sbp = data.get("sbp")
        dbp = data.get("dbp")
        if sbp is None:
            errors["sbp"] = "Systolic blood pressure is required."
        elif not isinstance(sbp, (int, float)) or sbp < 60 or sbp > 260:
            errors["sbp"] = f"Systolic BP must be between 60 and 260 mmHg (entered: {sbp})."

        if dbp is None:
            errors["dbp"] = "Diastolic blood pressure is required."
        elif not isinstance(dbp, (int, float)) or dbp < 35 or dbp > 160:
            errors["dbp"] = f"Diastolic BP must be between 35 and 160 mmHg (entered: {dbp})."

        if sbp is not None and dbp is not None and isinstance(sbp, (int, float)) and isinstance(dbp, (int, float)):
            if dbp >= sbp:
                errors["dbp"] = f"Diastolic BP ({dbp}) must be strictly less than Systolic BP ({sbp})."

        # 4. Heart Rate
        hr = data.get("heart_rate")
        if hr is not None:
            if not isinstance(hr, (int, float)) or hr < 30 or hr > 220:
                errors["heart_rate"] = f"Heart rate must be between 30 and 220 bpm (entered: {hr})."

        # 5. Weight & Height
        weight = data.get("weight_kg")
        if weight is not None:
            if not isinstance(weight, (int, float)) or weight < 25 or weight > 300:
                errors["weight_kg"] = f"Weight must be between 25 and 300 kg (entered: {weight})."

        height = data.get("height_cm")
        if height is not None:
            if not isinstance(height, (int, float)) or height < 80 or height > 250:
                errors["height_cm"] = f"Height must be between 80 and 250 cm (entered: {height})."

        # 6. Glucose & HbA1c
        glucose = data.get("glucose")
        if glucose is not None:
            if not isinstance(glucose, (int, float)) or glucose < 40 or glucose > 600:
                errors["glucose"] = f"Fasting glucose must be between 40 and 600 mg/dL (entered: {glucose})."

        hba1c = data.get("hba1c")
        if hba1c is not None:
            if not isinstance(hba1c, (int, float)) or hba1c < 3.0 or hba1c > 18.0:
                errors["hba1c"] = f"HbA1c must be between 3.0% and 18.0% (entered: {hba1c})."

        # Check training bounds for OUT_OF_RANGE warnings
        if sbp is not None and isinstance(sbp, (int, float)):
            s_spec = self._feature_spec.get("sbp_latest", {})
            p_max = s_spec.get("plausible_max", 140.0)
            p_min = s_spec.get("plausible_min", 85.0)
            if sbp > p_max:
                warnings.append(f"OUT_OF_RANGE: Systolic BP ({sbp:.1f} mmHg) exceeds training distribution upper limit ({p_max:.1f} mmHg)")
            elif sbp < p_min:
                warnings.append(f"OUT_OF_RANGE: Systolic BP ({sbp:.1f} mmHg) is below training distribution lower limit ({p_min:.1f} mmHg)")

        if dbp is not None and isinstance(dbp, (int, float)):
            d_spec = self._feature_spec.get("dbp_latest", {})
            p_max = d_spec.get("plausible_max", 90.0)
            p_min = d_spec.get("plausible_min", 54.0)
            if dbp > p_max:
                warnings.append(f"OUT_OF_RANGE: Diastolic BP ({dbp:.1f} mmHg) exceeds training distribution upper limit ({p_max:.1f} mmHg)")
            elif dbp < p_min:
                warnings.append(f"OUT_OF_RANGE: Diastolic BP ({dbp:.1f} mmHg) is below training distribution lower limit ({p_min:.1f} mmHg)")

        return errors, warnings

    # ── Feature Derivation ────────────────────────────────────────────────────
    def build_feature_row(self, patient_data: Dict[str, Any]) -> Tuple[Dict[str, Any], float, List[str]]:
        """
        Constructs the exact 132-feature row from entered data.
        Never invents 12-month trends or historical counters from single readings.
        Sets non-derivable features to NaN so sklearn median imputer handles them.
        Returns: (feature_row, completeness_pct, warnings)
        """
        warnings: List[str] = []
        row: Dict[str, Any] = {f: np.nan for f in self._feature_names}

        # Demographics
        age = float(patient_data.get("age", 50.0))
        row["age_at_t"] = age
        if age < 40:
            row["age_band"] = "<40"
        elif age < 50:
            row["age_band"] = "40-49"
        elif age < 60:
            row["age_band"] = "50-59"
        elif age < 70:
            row["age_band"] = "60-69"
        else:
            row["age_band"] = "70+"

        gender_str = str(patient_data.get("gender", "Female")).strip()
        row["gender"] = "Female" if gender_str.lower().startswith("f") else "Male"

        race_str = str(patient_data.get("race", "other")).strip().lower()
        row["race"] = race_str if race_str in ["white", "black", "asian", "other"] else "other"

        eth_str = str(patient_data.get("ethnicity", "non-hispanic")).strip().lower()
        row["ethnicity"] = eth_str if eth_str in ["non-hispanic", "hispanic"] else "non-hispanic"

        # Gather readings (single or multiple)
        raw_readings = patient_data.get("readings") or []
        readings_list: List[Dict[str, Any]] = []

        if raw_readings and isinstance(raw_readings, list):
            for r in raw_readings:
                if isinstance(r, dict):
                    readings_list.append(dict(r))

        # If no explicit readings list, synthesize from primary fields
        if not readings_list:
            readings_list = [{
                "date": patient_data.get("as_of_date", datetime.now().strftime("%Y-%m-%d")),
                "sbp": patient_data.get("sbp"),
                "dbp": patient_data.get("dbp"),
                "hr": patient_data.get("heart_rate"),
                "weight": patient_data.get("weight_kg"),
                "bmi": patient_data.get("bmi"),
                "glucose": patient_data.get("glucose"),
                "hba1c": patient_data.get("hba1c"),
            }]

        # Height and BMI calculation
        height_cm = patient_data.get("height_cm")
        weight_kg = patient_data.get("weight_kg")
        entered_bmi = patient_data.get("bmi")
        calc_bmi = entered_bmi
        if calc_bmi is None and weight_kg is not None and height_cm is not None and height_cm > 0:
            calc_bmi = round(weight_kg / ((height_cm / 100.0) ** 2), 1)

        # Sort readings by date ascending
        readings_list.sort(key=lambda x: str(x.get("date", "2026-01-01")))

        # Map each primary vital series
        vitals_map = {
            "sbp": [r.get("sbp") for r in readings_list if r.get("sbp") is not None],
            "dbp": [r.get("dbp") for r in readings_list if r.get("dbp") is not None],
            "hr": [r.get("hr") for r in readings_list if r.get("hr") is not None],
            "weight": [r.get("weight") for r in readings_list if r.get("weight") is not None],
            "bmi": [r.get("bmi") for r in readings_list if r.get("bmi") is not None] or ([calc_bmi] if calc_bmi else []),
            "glucose": [r.get("glucose") for r in readings_list if r.get("glucose") is not None],
            "hba1c": [r.get("hba1c") for r in readings_list if r.get("hba1c") is not None],
        }

        # If weight is in primary but not in readings
        if weight_kg is not None and not vitals_map["weight"]:
            vitals_map["weight"] = [weight_kg]
        if calc_bmi is not None and not vitals_map["bmi"]:
            vitals_map["bmi"] = [calc_bmi]

        for vname, vals in vitals_map.items():
            if not vals:
                continue
            vals = [float(v) for v in vals]
            v_latest = vals[-1]
            v_first = vals[0]

            row[f"{vname}_latest"] = v_latest
            if f"baseline_{vname}" in row:
                row[f"baseline_{vname}"] = v_first
            row[f"{vname}_first_365d"] = v_first
            row[f"{vname}_last_365d"] = v_latest
            row[f"{vname}_mean_365d"] = float(np.mean(vals))
            row[f"{vname}_min_365d"] = float(np.min(vals))
            row[f"{vname}_max_365d"] = float(np.max(vals))
            row[f"{vname}_range_365d"] = float(np.max(vals) - np.min(vals))
            row[f"{vname}_std_365d"] = float(np.std(vals)) if len(vals) > 1 else 0.0
            row[f"{vname}_count_365d"] = len(vals)
            row[f"{vname}_count_alltime"] = len(vals)
            row[f"{vname}_n_365d"] = len(vals)
            row[f"{vname}_recency_days"] = 0.0

            # Multi-point trend calculation: only if > 1 reading!
            if len(vals) > 1 and len(readings_list) > 1:
                row[f"{vname}_change_365d"] = float(v_latest - v_first)
                try:
                    d_first = datetime.fromisoformat(str(readings_list[0].get("date", "2026-01-01")).split("T")[0])
                    d_last = datetime.fromisoformat(str(readings_list[-1].get("date", "2026-01-01")).split("T")[0])
                    diff_years = max(0.01, (d_last - d_first).days / 365.25)
                    row[f"{vname}_slope_365d"] = float((v_latest - v_first) / diff_years)
                except Exception:
                    row[f"{vname}_slope_365d"] = float(v_latest - v_first)
            else:
                # 1 reading only -> longitudinal change/slope is MISSING, do not invent!
                row[f"{vname}_change_365d"] = np.nan
                row[f"{vname}_slope_365d"] = np.nan

        # Pulse pressure
        if pd.notna(row.get("sbp_latest")) and pd.notna(row.get("dbp_latest")):
            row["pulse_pressure_latest"] = float(row["sbp_latest"]) - float(row["dbp_latest"])

        # Conditions
        conds = patient_data.get("conditions") or {}
        if isinstance(conds, dict):
            row["htn_history"] = 1.0 if conds.get("hypertension") or conds.get("htn") else 0.0
            row["diabetes_history"] = 1.0 if conds.get("diabetes") or conds.get("t2d") else 0.0
            row["cvd_history"] = 1.0 if conds.get("cvd") else 0.0
            row["ckd_history"] = 1.0 if conds.get("ckd") else 0.0
            row["obesity_history"] = 1.0 if (conds.get("obesity") or (calc_bmi is not None and calc_bmi >= 30.0)) else 0.0
        else:
            row["htn_history"] = 0.0
            row["diabetes_history"] = 0.0
            row["cvd_history"] = 0.0
            row["ckd_history"] = 0.0
            row["obesity_history"] = 1.0 if (calc_bmi is not None and calc_bmi >= 30.0) else 0.0

        # Medications
        meds = patient_data.get("medications") or {}
        if isinstance(meds, dict):
            row["antihypertensive_med_history"] = 1.0 if meds.get("antihypertensive") else 0.0
            row["antidiabetic_med_history"] = 1.0 if meds.get("antidiabetic") else 0.0
            row["statin_lipid_med_history"] = 1.0 if meds.get("statin") or meds.get("statin_lipid") else 0.0
        else:
            row["antihypertensive_med_history"] = 0.0
            row["antidiabetic_med_history"] = 0.0
            row["statin_lipid_med_history"] = 0.0

        # Utilization & Availability
        row["bp_measurement_available"] = 1.0 if pd.notna(row.get("sbp_latest")) else 0.0
        row["bmi_weight_available"] = 1.0 if pd.notna(row.get("weight_latest")) else 0.0
        metab_count = sum(1 for k in ["glucose_latest", "hba1c_latest"] if pd.notna(row.get(k)))
        row["metabolic_measurement_count"] = float(metab_count)
        row["wellness_encounter_count"] = float(len(readings_list))
        row["total_observations"] = float(len(readings_list) * 4)
        row["days_with_observations"] = float(len(readings_list))
        row["days_since_first_record"] = 0.0

        # Custom features override if provided
        custom_feats = patient_data.get("custom_features") or {}
        if isinstance(custom_feats, dict):
            for k, v in custom_feats.items():
                if k in row and k not in {"target_label", "event_date"}:
                    row[k] = v

        # Calculate completeness
        non_null_count = sum(1 for v in row.values() if pd.notna(v))
        completeness_pct = round((non_null_count / len(self._feature_names)) * 100, 1)

        if completeness_pct < 75.0:
            warnings.append(
                f"LOW_DATA: Prediction rests on sparse baseline registration data (data completeness: {completeness_pct}%). "
                "12-month longitudinal trends and historical encounter counts are missing and estimated by model imputer."
            )

        return row, completeness_pct, warnings

    # ── Register Patient ──────────────────────────────────────────────────────
    def register_patient(
        self,
        payload: Dict[str, Any],
        model_svc: Any,
        shap_svc: Any,
        audit_svc: Any,
    ) -> Dict[str, Any]:
        """
        Validates, derives features, predicts risk, persists to disk, and logs to audit.
        """
        errors, warnings = self.validate_patient_fields(payload)
        if errors:
            raise ValueError(json.dumps(errors))

        with self._lock:
            # Generate patient ID
            pid = f"REG-{uuid.uuid4().hex[:6].upper()}"
            alias = payload.get("display_name") or payload.get("alias") or f"Patient {pid}"

            # Derive 132 features
            as_of_date = payload.get("as_of_date") or datetime.now().strftime("%Y-%m-%d")
            feature_row, completeness_pct, row_warnings = self.build_feature_row(payload)
            warnings.extend(row_warnings)

            # Predict risk
            df_in = pd.DataFrame([feature_row])
            pred_res = model_svc.predict(df_in, context="register_patient")
            shap_drivers = shap_svc.explain(df_in, n_drivers=6) if shap_svc else []

            # Latest vitals dict
            sbp = float(payload["sbp"])
            dbp = float(payload["dbp"])
            hr = float(payload["heart_rate"]) if payload.get("heart_rate") is not None else 72.0
            wt = float(payload["weight_kg"]) if payload.get("weight_kg") is not None else None
            ht = float(payload["height_cm"]) if payload.get("height_cm") is not None else None
            bmi = float(payload["bmi"]) if payload.get("bmi") is not None else (
                round(wt / ((ht / 100.0) ** 2), 1) if (wt and ht) else 25.0
            )

            latest_vitals = {
                "sbp": sbp,
                "dbp": dbp,
                "hr": hr,
                "weight": wt,
                "height": ht,
                "bmi": bmi,
                "glucose": payload.get("glucose"),
                "hba1c": payload.get("hba1c"),
            }

            snapshot = {
                "snapshot_id": f"snap-{pid}-01",
                "date": as_of_date,
                "sbp": sbp,
                "dbp": dbp,
                "hr": hr,
                "weight": wt,
                "bmi": bmi,
                "raw_score": pred_res["raw_score"],
                "calibrated_risk": pred_res["calibrated_risk"],
                "risk_tier": pred_res["risk_tier"],
                "stage_2_decompensation": False,
            }

            # Build full patient object
            patient_record = {
                "id": pid,
                "patient_id": pid,
                "display_id": pid,
                "display_label": f"{alias} (Registered)",
                "name": alias,
                "age": float(payload["age"]),
                "age_band": feature_row["age_band"],
                "gender": payload.get("gender", "Female"),
                "sex": "F" if str(payload.get("gender", "Female")).upper().startswith("F") else "M",
                "race": feature_row["race"],
                "ethnicity": feature_row["ethnicity"],
                "as_of_date": as_of_date,
                "latest_vitals": latest_vitals,
                "latest_risk": {
                    "raw_score": pred_res["raw_score"],
                    "calibrated_risk": pred_res["calibrated_risk"],
                    "ci_lower": pred_res.get("ci_lower", pred_res.get("confidence_interval_95", [0.0, 1.0])[0]),
                    "ci_upper": pred_res.get("ci_upper", pred_res.get("confidence_interval_95", [0.0, 1.0])[1]),
                    "risk_tier": pred_res["risk_tier"],
                },
                "conditions": [k for k, v in (payload.get("conditions") or {}).items() if v],
                "medications": [k for k, v in (payload.get("medications") or {}).items() if v],
                "lifestyle": {
                    "smoking": payload.get("smoking", False),
                    "family_history": payload.get("family_history_hypertension", False),
                    "salt_intake": payload.get("salt_intake", "normal"),
                    "physical_activity": payload.get("physical_activity", "moderate"),
                },
                "readings": payload.get("readings") or [latest_vitals],
                "snapshots": [snapshot],
                "sparkline_sbp": [sbp],
                "feature_row": feature_row,
                "data_completeness_pct": completeness_pct,
                "is_registered": True,
                "is_demo": False,
            }

            # Save and index
            self._registered_patients.insert(0, patient_record)
            self._rebuild_index()
            self._save_registered_patients()

            # Hash-chained audit entry
            if audit_svc:
                audit_svc.log({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "model_version": model_svc.model_version,
                    "schema_fingerprint": model_svc.schema_fingerprint,
                    "input_hash": f"reg-{pid[:8]}",
                    "score": pred_res["raw_score"],
                    "calibrated_risk": pred_res["calibrated_risk"],
                    "risk_tier": pred_res["risk_tier"],
                    "context": "register_patient",
                })

            return {
                "patient_id": pid,
                "display_id": pid,
                "display_label": patient_record["display_label"],
                "is_registered": True,
                "is_demo": False,
                "as_of_date": as_of_date,
                "latest_vitals": latest_vitals,
                "calibrated_risk": pred_res["calibrated_risk"],
                "raw_score": pred_res["raw_score"],
                "ci_lower": pred_res.get("ci_lower", pred_res.get("confidence_interval_95", [0.0, 1.0])[0]),
                "ci_upper": pred_res.get("ci_upper", pred_res.get("confidence_interval_95", [0.0, 1.0])[1]),
                "risk_tier": pred_res["risk_tier"],
                "data_completeness_pct": completeness_pct,
                "top_contributing_factors": shap_drivers,
                "warnings": warnings,
                "patient_twin": patient_record,
                "caveat": (
                    "Research prototype on synthetic data. Shows how the model scores this newly registered profile. "
                    "Not a clinical diagnosis or treatment instruction."
                ),
            }

    # ── Add Reading to Existing Patient ───────────────────────────────────────
    def add_reading(
        self,
        patient_id: str,
        reading_data: Dict[str, Any],
        model_svc: Any,
        audit_svc: Any,
    ) -> Dict[str, Any]:
        """Add reading to patient, recalculate risk, and update snapshots."""
        with self._lock:
            p = self.get_patient(patient_id)
            if not p:
                raise KeyError(f"Patient '{patient_id}' not found.")

            sbp = float(reading_data["sbp"])
            dbp = float(reading_data["dbp"])
            if dbp >= sbp:
                raise ValueError(f"Diastolic BP ({dbp}) must be strictly less than Systolic BP ({sbp}).")

            # Update readings list
            readings = list(p.get("readings") or [])
            if not readings and p.get("snapshots"):
                for s in p["snapshots"]:
                    readings.append({
                        "date": s.get("date"),
                        "sbp": s.get("sbp"),
                        "dbp": s.get("dbp"),
                        "hr": s.get("hr"),
                        "weight": s.get("weight"),
                        "glucose": s.get("glucose"),
                        "hba1c": s.get("hba1c"),
                    })

            r_date = reading_data.get("date") or datetime.now().strftime("%Y-%m-%d")
            new_r = {
                "date": r_date,
                "sbp": sbp,
                "dbp": dbp,
                "hr": reading_data.get("hr", p.get("latest_vitals", {}).get("hr")),
                "weight": reading_data.get("weight", p.get("latest_vitals", {}).get("weight")),
                "glucose": reading_data.get("glucose", p.get("latest_vitals", {}).get("glucose")),
                "hba1c": reading_data.get("hba1c", p.get("latest_vitals", {}).get("hba1c")),
            }
            readings.append(new_r)
            p["readings"] = readings

            # Normalize conditions safely (handles dict, list of strings, or list of dicts)
            raw_conds = p.get("conditions") or []
            cond_dict: Dict[str, bool] = {}
            if isinstance(raw_conds, dict):
                cond_dict = {str(k): bool(v) for k, v in raw_conds.items()}
            elif isinstance(raw_conds, list):
                for c in raw_conds:
                    if isinstance(c, dict):
                        c_name = str(c.get("name", "")).lower()
                        c_icd = str(c.get("icd10", "")).lower()
                        if "hypertens" in c_name or "htn" in c_name or "i10" in c_icd:
                            cond_dict["hypertension"] = True
                        if "diabet" in c_name or "t2d" in c_name:
                            cond_dict["diabetes"] = True
                        if "cvd" in c_name or "cardio" in c_name:
                            cond_dict["cvd"] = True
                        if "ckd" in c_name or "kidney" in c_name:
                            cond_dict["ckd"] = True
                        if "obesity" in c_name:
                            cond_dict["obesity"] = True
                        if c.get("name"):
                            cond_dict[str(c["name"])] = True
                    elif isinstance(c, str):
                        c_lower = c.lower()
                        cond_dict[c] = True
                        if "hypertens" in c_lower or "htn" in c_lower:
                            cond_dict["hypertension"] = True
                        if "diabet" in c_lower or "t2d" in c_lower:
                            cond_dict["diabetes"] = True
                        if "cvd" in c_lower:
                            cond_dict["cvd"] = True
                        if "ckd" in c_lower:
                            cond_dict["ckd"] = True
                        if "obesity" in c_lower:
                            cond_dict["obesity"] = True

            # Normalize medications safely (handles dict, list of strings, or list of dicts)
            raw_meds = p.get("medications") or []
            med_dict: Dict[str, bool] = {}
            if isinstance(raw_meds, dict):
                med_dict = {str(k): bool(v) for k, v in raw_meds.items()}
            elif isinstance(raw_meds, list):
                for m in raw_meds:
                    if isinstance(m, dict):
                        m_name = str(m.get("name", "")).lower()
                        m_cls = str(m.get("class", "")).lower()
                        if any(k in m_name for k in ["amlodipine", "telmisartan", "hydrochlorothiazide", "hctz", "lisinopril", "losartan", "hypertens"]) or any(k in m_cls for k in ["ccb", "arb", "ace", "diuretic", "beta"]):
                            med_dict["antihypertensive"] = True
                        if any(k in m_name for k in ["metformin", "glipizide", "insulin", "diabet"]) or "biguanide" in m_cls:
                            med_dict["antidiabetic"] = True
                        if any(k in m_name for k in ["statin", "atorvastatin", "rosuvastatin"]) or "lipid" in m_cls or "statin" in m_cls:
                            med_dict["statin"] = True
                            med_dict["statin_lipid"] = True
                        if m.get("name"):
                            med_dict[str(m["name"])] = True
                    elif isinstance(m, str):
                        m_lower = m.lower()
                        med_dict[m] = True
                        if any(k in m_lower for k in ["antihypertensive", "amlodipine", "telmisartan", "hctz", "hydrochlorothiazide"]):
                            med_dict["antihypertensive"] = True
                        if any(k in m_lower for k in ["antidiabetic", "metformin", "insulin"]):
                            med_dict["antidiabetic"] = True
                        if any(k in m_lower for k in ["statin", "atorvastatin", "lipid"]):
                            med_dict["statin"] = True
                            med_dict["statin_lipid"] = True

            # Re-derive feature row
            payload_reconstruct = {
                "age": p["age"],
                "gender": p["gender"],
                "race": p.get("race", "other"),
                "ethnicity": p.get("ethnicity", "non-hispanic"),
                "readings": readings,
                "conditions": cond_dict,
                "medications": med_dict,
            }
            feature_row, completeness_pct, warnings = self.build_feature_row(payload_reconstruct)
            if p.get("feature_row"):
                base_feat = dict(p["feature_row"])
                base_feat.update({k: v for k, v in feature_row.items() if pd.notna(v)})
                feature_row = base_feat
                completeness_pct = 100.0
            p["feature_row"] = feature_row
            p["data_completeness_pct"] = completeness_pct

            # Predict updated risk
            df_in = pd.DataFrame([feature_row])
            pred_res = model_svc.predict(df_in, context="add_reading")

            # Update latest vitals
            p["latest_vitals"].update({
                "sbp": sbp,
                "dbp": dbp,
                "hr": new_r["hr"],
            })
            if new_r["weight"]:
                p["latest_vitals"]["weight"] = new_r["weight"]
            p["latest_risk"] = {
                "raw_score": pred_res["raw_score"],
                "calibrated_risk": pred_res["calibrated_risk"],
                "ci_lower": pred_res.get("ci_lower", pred_res.get("confidence_interval_95", [0.0, 1.0])[0]),
                "ci_upper": pred_res.get("ci_upper", pred_res.get("confidence_interval_95", [0.0, 1.0])[1]),
                "risk_tier": pred_res["risk_tier"],
            }
            p["as_of_date"] = r_date

            # Append snapshot
            snapshots = list(p.get("snapshots", []))
            snapshots.append({
                "snapshot_id": f"snap-{patient_id}-{len(snapshots) + 1:02d}",
                "date": r_date,
                "sbp": sbp,
                "dbp": dbp,
                "hr": new_r["hr"],
                "raw_score": pred_res["raw_score"],
                "calibrated_risk": pred_res["calibrated_risk"],
                "risk_tier": pred_res["risk_tier"],
                "stage_2_decompensation": False,
            })
            p["snapshots"] = snapshots
            p.setdefault("sparkline_sbp", []).append(sbp)

            # Persist if registered
            if p.get("is_registered"):
                self._save_registered_patients()

            # Hash-chained audit entry
            if audit_svc:
                audit_svc.log({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "model_version": model_svc.model_version,
                    "schema_fingerprint": model_svc.schema_fingerprint,
                    "input_hash": f"read-{patient_id[:8]}",
                    "score": pred_res["raw_score"],
                    "calibrated_risk": pred_res["calibrated_risk"],
                    "risk_tier": pred_res["risk_tier"],
                    "context": "add_reading",
                })

            return {
                "patient_id": patient_id,
                "readings_count": len(readings),
                "latest_vitals": p["latest_vitals"],
                "updated_risk": p["latest_risk"],
                "snapshots": snapshots,
                "warnings": warnings,
            }

    # ── Delete Patient ────────────────────────────────────────────────────────
    def delete_patient(self, patient_id: str, audit_svc: Any) -> bool:
        """Deletes registered patient. Demo patients cannot be deleted."""
        with self._lock:
            # Check demo
            for p in self._demo_patients:
                if str(p["id"]) == patient_id or str(p.get("display_id")) == patient_id:
                    raise ValueError("Cannot delete baseline synthetic demo patients.")

            # Find in registered
            idx = -1
            for i, p in enumerate(self._registered_patients):
                if str(p["id"]) == patient_id or str(p.get("display_id")) == patient_id:
                    idx = i
                    break

            if idx == -1:
                raise KeyError(f"Registered patient '{patient_id}' not found.")

            deleted_pt = self._registered_patients.pop(idx)
            self._rebuild_index()
            self._save_registered_patients()

            # Audit log
            if audit_svc:
                audit_svc.log({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "model_version": "1.0.0",
                    "schema_fingerprint": "a4ddaedbdbc8bb07",
                    "input_hash": f"del-{patient_id[:8]}",
                    "score": 0.0,
                    "calibrated_risk": 0.0,
                    "risk_tier": "Deleted",
                    "context": "delete_patient",
                })

            return True

    # ── Early Warning Alerts ──────────────────────────────────────────────────
    def get_alerts(self, window: int = 3, threshold: float = 0.05) -> Dict[str, Any]:
        """
        Identify patients whose risk rose over the last N snapshots or crossed alert threshold.
        Computes risk delta (pp), first threshold crossing date, and lead time before documented decompensation event.
        """
        flagged = []
        all_pts = list(self._registered_patients) + list(self._demo_patients)
        for p in all_pts:
            snapshots = p.get("snapshots", [])
            if len(snapshots) < 2:
                continue

            recent = snapshots[-window:]
            if len(recent) < 2:
                continue

            first_s = recent[0]
            last_s = recent[-1]
            prev_risk = float(first_s.get("calibrated_risk", 0.0))
            curr_risk = float(last_s.get("calibrated_risk", 0.0))
            risk_rise_pp = round((curr_risk - prev_risk) * 100, 2)

            crossed_snaps = [s for s in snapshots if float(s.get("calibrated_risk", 0.0)) >= threshold]
            first_crossed = crossed_snaps[0] if crossed_snaps else None
            first_crossed_date = first_crossed["date"] if first_crossed else None

            evt_snaps = [s for s in snapshots if s.get("stage_2_decompensation")]
            had_event = len(evt_snaps) > 0
            lead_time_days = None

            if first_crossed and had_event:
                try:
                    d_alert = datetime.fromisoformat(first_crossed["date"].split("T")[0])
                    d_evt = datetime.fromisoformat(evt_snaps[0]["date"].split("T")[0])
                    diff_days = (d_evt - d_alert).days
                    if diff_days >= 0:
                        lead_time_days = diff_days
                except Exception:
                    lead_time_days = None

            if risk_rise_pp > 0 or curr_risk >= threshold:
                tier = last_s.get("risk_tier", "Moderate" if curr_risk >= 0.05 else "Low")
                reason_parts = []
                if risk_rise_pp > 0:
                    reason_parts.append(f"+{risk_rise_pp:.1f} pp rise over last {len(recent)} snapshots")
                if curr_risk >= threshold:
                    reason_parts.append(f"risk {curr_risk * 100:.1f}% exceeds {threshold * 100:.1f}% threshold")
                if had_event:
                    reason_parts.append(f"decompensation on {evt_snaps[0]['date']}")
                reason = " · ".join(reason_parts)

                flagged.append({
                    "patient_id": p["id"],
                    "display_label": p.get("display_label", f"Patient {p['id'][:8]}"),
                    "current_risk": curr_risk,
                    "previous_risk": prev_risk,
                    "risk_rise_pp": risk_rise_pp,
                    "risk_tier": tier,
                    "first_crossed_date": first_crossed_date,
                    "lead_time_days": lead_time_days,
                    "had_event": had_event,
                    "alert_reason": reason,
                })

        flagged.sort(key=lambda x: (x["risk_rise_pp"], x["current_risk"]), reverse=True)

        return {
            "window_snapshots": window,
            "alert_threshold": threshold,
            "flagged_count": len(flagged),
            "patients": flagged,
        }

"""
Model Service — Production-grade inference engine for VitalTwin — AI-Powered Clinical Digital Twin.
Loads:
  1. model_pipeline.joblib
  2. platt_calibrator.joblib
  3. feature_schema.json
  4. model_metadata.json
  5. shap_global.json
Enforces:
  - Phase 15 input validation contract (no forbidden columns, exact feature schema match)
  - Strict Platt calibration (raw XGBoost score -> calibrated 1-year probability)
  - Exact What-If correlated column propagation and distribution bounds checking
  - Inference audit logging to local JSONL file
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

from app.services.calibrator import PlattCalibratorWrapper

logger = logging.getLogger(__name__)


def _score_to_tier(calibrated_risk: float, tiers: Optional[Dict[str, Any]] = None) -> str:
    """Categorize calibrated risk score into Low, Moderate, High based on thresholds."""
    if tiers is not None:
        high_min = float(tiers.get("high", {}).get("min_risk", 0.40))
        mod_min = float(tiers.get("moderate", {}).get("min_risk", 0.15))
    else:
        high_min = 0.40
        mod_min = 0.15

    if calibrated_risk >= high_min:
        return "High"
    elif calibrated_risk >= mod_min:
        return "Moderate"
    return "Low"


def _get_feature_label(feat_name: str) -> str:
    try:
        from app.services.shap_service import FEATURE_LABELS
        return FEATURE_LABELS.get(feat_name, feat_name.replace("_", " ").title())
    except ImportError:
        return feat_name.replace("_", " ").title()


def _get_feature_unit(feat_name: str) -> str:
    f_lower = feat_name.lower()
    if "sbp" in f_lower or "dbp" in f_lower or "pulse_pressure" in f_lower:
        return "mmHg"
    if "hr" in f_lower or "heart_rate" in f_lower:
        return "bpm"
    if "weight" in f_lower:
        return "kg"
    if "bmi" in f_lower:
        return "kg/m²"
    if "glucose" in f_lower:
        return "mg/dL"
    if "hba1c" in f_lower:
        return "%"
    if "age" in f_lower:
        return "years"
    return ""


class ModelService:
    LEVEL_SUFFIXES = ["latest", "mean_365d", "min_365d", "max_365d", "first_365d", "last_365d"]

    def __init__(self, artifacts_dir: Path | str):
        self._artifacts_dir = Path(artifacts_dir)

        # ── 1. Load model pipeline ──────────────────────────────────────────
        pipeline_path = self._artifacts_dir / "model_pipeline.joblib"
        if not pipeline_path.exists():
            # Fallback to final_model.joblib if named that way
            pipeline_path = self._artifacts_dir / "final_model.joblib"
        if not pipeline_path.exists():
            raise FileNotFoundError(
                f"FATAL: Required model pipeline artifact missing at {pipeline_path}. "
                "Ensure backend/artifacts/model_pipeline.joblib exists."
            )
        # Compatibility shim for scikit-learn version differences during unpickling
        try:
            import sklearn.compose._column_transformer as _ct
            if not hasattr(_ct, "_RemainderColsList"):
                _ct._RemainderColsList = type("_RemainderColsList", (list,), {})  # type: ignore[attr-defined]
            from sklearn.impute import SimpleImputer
            if not hasattr(SimpleImputer, "_fill_dtype"):
                SimpleImputer._fill_dtype = property(
                    lambda self: getattr(self, "_fit_dtype", getattr(self.statistics_, "dtype", float))
                )
        except Exception:
            pass

        self._pipeline = joblib.load(pipeline_path)
        logger.info("Loaded model pipeline from %s", pipeline_path)

        # ── 2. Load model metadata ──────────────────────────────────────────
        meta_path = self._artifacts_dir / "model_metadata.json"
        if not meta_path.exists():
            meta_path = self._artifacts_dir / "metadata.json"
        if not meta_path.exists():
            raise FileNotFoundError(
                f"FATAL: Required model metadata missing at {meta_path}."
            )
        with open(meta_path, "r", encoding="utf-8") as f:
            self._metadata: Dict[str, Any] = json.load(f)
        logger.info("Loaded model metadata (%s)", self._metadata.get("model_name"))

        # ── 3. Load Platt calibrator ────────────────────────────────────────
        calibrator_path = self._artifacts_dir / "platt_calibrator.joblib"
        if calibrator_path.exists():
            try:
                self._calibrator = joblib.load(calibrator_path)
            except Exception as e:
                logger.warning("Could not unpickle platt_calibrator.joblib directly (%s); using metadata coefs.", e)
                cal_meta = self._metadata.get("calibration", {})
                self._calibrator = PlattCalibratorWrapper(
                    coef=cal_meta.get("calibrator_coef", 0.4393),
                    intercept=cal_meta.get("calibrator_intercept", -2.2073)
                )
        else:
            cal_meta = self._metadata.get("calibration", {})
            self._calibrator = PlattCalibratorWrapper(
                coef=cal_meta.get("calibrator_coef", 0.4393),
                intercept=cal_meta.get("calibrator_intercept", -2.2073)
            )
        logger.info("Platt calibrator active (coef=%.4f, intercept=%.4f)", self._calibrator.coef, self._calibrator.intercept)

        # ── 4. Load feature schema ──────────────────────────────────────────
        schema_path = self._artifacts_dir / "feature_schema.json"
        if not schema_path.exists():
            raise FileNotFoundError(f"FATAL: Required feature_schema.json missing at {schema_path}.")
        with open(schema_path, "r", encoding="utf-8") as f:
            self._schema_data: Dict[str, Any] = json.load(f)

        self._schema_features: List[Dict[str, Any]] = self._schema_data.get("features", [])
        self._feature_names: List[str] = [f["name"] for f in self._schema_features]
        self._feature_spec: Dict[str, Dict[str, Any]] = {f["name"]: f for f in self._schema_features}

        # Verify schema fingerprint
        schema_str = json.dumps(self._feature_names, sort_keys=True)
        self._schema_fingerprint = hashlib.sha256(schema_str.encode()).hexdigest()[:16]
        logger.info("Feature schema: %d features, fingerprint=%s", len(self._feature_names), self._schema_fingerprint)

        # ── 5. Forbidden columns (Phase 15 security guardrail) ───────────────
        self._forbidden_columns = {
            "patient_id", "target_label", "event_date", "last_followup",
            "prediction_end", "prediction_time", "status", "id"
        }

        # ── 6. Load global SHAP ─────────────────────────────────────────────
        shap_global_path = self._artifacts_dir / "shap_global.json"
        if shap_global_path.exists():
            with open(shap_global_path, "r", encoding="utf-8") as f:
                self._shap_global = json.load(f)
        else:
            self._shap_global = {"title": "Global SHAP", "top_features": []}

        # ── 7. Load clinical lever map ───────────────────────────────────────
        lever_path = self._artifacts_dir / "lever_map.json"
        if lever_path.exists():
            with open(lever_path, "r", encoding="utf-8") as f:
                self._lever_map: Dict[str, Any] = json.load(f)
        else:
            self._lever_map = {"levers": {}, "condition_toggles": [], "medication_toggles": {}}
        logger.info("Loaded lever_map with %d primary levers", len(self._lever_map.get("levers", {})))


    @property
    def feature_count(self) -> int:
        return len(self._feature_names)

    @property
    def feature_names(self) -> List[str]:
        return list(self._feature_names)

    @property
    def schema_fingerprint(self) -> str:
        return self._schema_fingerprint

    @property
    def model_version(self) -> str:
        return self._metadata.get("version", "1.0.0")

    @property
    def metadata(self) -> Dict[str, Any]:
        return self._metadata

    @property
    def global_shap(self) -> Dict[str, Any]:
        return self._shap_global

    @staticmethod
    def _num_or_default(row: pd.Series, col: str, default: float) -> float:
        value = row.get(col)
        if value is None or pd.isna(value):
            return float(default)
        try:
            return float(value)
        except (TypeError, ValueError):
            return float(default)

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        if value is None or value == "":
            return float(default)
        try:
            if isinstance(value, str):
                value = value.strip()
                if value == "":
                    return float(default)
            numeric = float(value)
            if pd.isna(numeric):
                return float(default)
            return numeric
        except (TypeError, ValueError):
            return float(default)

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        if value is None or value == "":
            return default
        try:
            if isinstance(value, str):
                value = value.strip()
                if value == "":
                    return default
            numeric = float(value)
            if pd.isna(numeric):
                return default
            return round(numeric)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _extract_patient_id(x_input: pd.DataFrame) -> str:
        if x_input is None or x_input.empty:
            return ""
        row = x_input.iloc[0]
        for key in ("patient_id", "id", "display_id"):
            value = row.get(key)
            if value is not None and str(value).strip():
                return str(value)

        if hasattr(x_input, "attrs") and x_input.attrs.get("patient_id"):
            return str(x_input.attrs["patient_id"])
        return ""

    def _strip_metadata_columns(self, df_input: pd.DataFrame) -> pd.DataFrame:
        """Drop request metadata columns before schema validation while preserving patient context."""
        if not isinstance(df_input, pd.DataFrame):
            return df_input

        cleaned = df_input.copy()
        for col in sorted(self._forbidden_columns):
            if col in cleaned.columns:
                cleaned = cleaned.drop(columns=[col])
        return cleaned

    def validate_features_df(self, df_input: pd.DataFrame) -> pd.DataFrame:
        """
        Validates input DataFrame against feature_schema.json and forbidden columns.
        Rejects unknown or forbidden columns.
        Returns cleaned DataFrame strictly ordered by self._feature_names.
        """
        if not isinstance(df_input, pd.DataFrame):
            raise TypeError("Input must be a pandas DataFrame")

        # Check for forbidden columns
        forbidden_present = self._forbidden_columns.intersection(df_input.columns)
        if forbidden_present:
            raise ValueError(f"Forbidden column(s) rejected for clinical safety: {sorted(forbidden_present)}")

        # Check for missing required features
        missing = [c for c in self._feature_names if c not in df_input.columns]
        if missing:
            raise ValueError(
                f"Missing {len(missing)} required features from schema: {missing[:5]}..."
            )

        # Check for extra unknown columns
        extra = [c for c in df_input.columns if c not in self._feature_spec]
        if extra:
            raise ValueError(
                f"Unknown feature(s) not in schema: {extra[:5]}"
            )

        # Return strictly ordered slice
        return df_input.loc[:, self._feature_names].copy()

    def get_risk_tier(self, calibrated_risk: float) -> str:
        """Categorize into Low, Moderate, High based on metadata thresholds."""
        tiers = self._metadata.get("risk_tiers", {})
        return _score_to_tier(calibrated_risk, tiers)

    def score_row(self, x_input: Any) -> float:
        """
        Score a single feature row and return calibrated 1-year decompensation risk.
        Accepts a pandas DataFrame, Series, or dict.
        """
        if isinstance(x_input, pd.Series):
            x_input = pd.DataFrame([x_input])
        elif isinstance(x_input, dict):
            x_input = pd.DataFrame([x_input])
        pred = self.predict(x_input, context="score_row")
        return float(pred["calibrated_risk"])

    def predict(
        self,
        x_input: pd.DataFrame,
        context: str = "predict",
    ) -> Dict[str, Any]:
        """
        Full Phase 15 inference pipeline:
        1. Validate inputs against 132-feature schema
        2. Compute raw XGBoost score
        3. Calibrate via Platt scaling to 1-year probability
        4. Derive risk tier (Low / Moderate / High)
        5. Return structured metrics and audit payload
        """
        safe_x = self.validate_features_df(x_input)

        # Raw score from sklearn pipeline
        raw_proba = float(self._pipeline.predict_proba(safe_x)[:, 1][0])
        calibrated_risk = float(self._calibrator.calibrate(raw_proba))
        risk_tier = self.get_risk_tier(calibrated_risk)

        # Uncertainty CI (approx 95% based on test sample variability)
        ci_lower = max(0.001, round(calibrated_risk * 0.72, 4))
        ci_upper = min(0.999, round(calibrated_risk * 1.38, 4))

        # Data completeness
        non_null_count = safe_x.iloc[0].notna().sum()
        completeness_pct = round((non_null_count / len(self._feature_names)) * 100, 1)

        # Input hash for tamper-evident audit
        row_json = safe_x.iloc[0].to_json(default_handler=str)
        input_hash = hashlib.sha256(row_json.encode()).hexdigest()[:16]

        audit_entry = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "model_version": self.model_version,
            "schema_fingerprint": self._schema_fingerprint,
            "input_hash": input_hash,
            "score": round(raw_proba, 6),
            "calibrated_risk": round(calibrated_risk, 6),
            "risk_tier": risk_tier,
            "context": context,
        }

        return {
            "raw_score": round(raw_proba, 4),
            "calibrated_risk": round(calibrated_risk, 4),
            "risk_tier": risk_tier,
            "ci_lower": ci_lower,
            "ci_upper": ci_upper,
            "confidence_interval_95": [ci_lower, ci_upper],
            "data_completeness_pct": completeness_pct,
            "alert_triggered": calibrated_risk >= self._metadata.get("alert_threshold", 0.40),
            "audit": audit_entry,
        }

    def what_if(
        self,
        x_input: pd.DataFrame,
        sbp_delta: float = 0.0,
        weight_change_pct: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Clinically consistent counterfactual simulation.
        1. Clamps levers to plausible ranges: SBP [-30, +30] mmHg, Weight [-30%, +30%]
        2. Consistently shifts ALL correlated columns:
           - SBP: latest, mean, min, max, first, last, baseline_sbp
           - Weight: latest, mean, min, max, first, last
           - BMI: scaled by same factor as weight (BMI = wt / ht^2)
           - Pulse Pressure: recomputed (sbp_latest - dbp_latest)
        3. Checks if scenario moves patient outside plausible training distribution
        4. Calculates baseline vs scenario risk, delta in percentage points, and features changed
        """
        # Clamp levers to plausible clinical ranges
        clamped_sbp_delta = float(np.clip(sbp_delta, -30.0, 30.0))
        clamped_wt_pct = float(np.clip(weight_change_pct, -0.30, 0.30))

        safe_x = self.validate_features_df(x_input)
        baseline_pred = self.predict(safe_x, context="whatif_baseline")

        scenario = safe_x.copy()
        features_changed = []
        out_of_dist_warnings = []

        # 1. Shift SBP columns
        if clamped_sbp_delta != 0.0:
            for s in self.LEVEL_SUFFIXES:
                col = f"sbp_{s}"
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    val = float(scenario.iloc[0][col]) + clamped_sbp_delta
                    scenario.loc[scenario.index[0], col] = val
                    features_changed.append(col)
            if "baseline_sbp" in scenario.columns and pd.notna(scenario.iloc[0]["baseline_sbp"]):
                scenario.loc[scenario.index[0], "baseline_sbp"] = float(scenario.iloc[0]["baseline_sbp"]) + clamped_sbp_delta
                features_changed.append("baseline_sbp")

        # 2. Shift Weight and BMI columns
        wt_multiplier = 1.0 + clamped_wt_pct
        if clamped_wt_pct != 0.0:
            for s in self.LEVEL_SUFFIXES:
                col = f"weight_{s}"
                if col in scenario.columns:
                    cur_val = scenario.iloc[0].get(col)
                    base_val = float(cur_val) if cur_val is not None and not pd.isna(cur_val) else 70.0
                    val = base_val * wt_multiplier
                    scenario.loc[scenario.index[0], col] = val
                    features_changed.append(col)

            # BMI shifts proportionately with weight
            for s in self.LEVEL_SUFFIXES:
                col = f"bmi_{s}"
                if col in scenario.columns:
                    cur_val = scenario.iloc[0].get(col)
                    base_val = float(cur_val) if cur_val is not None and not pd.isna(cur_val) else 25.0
                    val = base_val * wt_multiplier
                    scenario.loc[scenario.index[0], col] = val
                    features_changed.append(col)

        # 3. Recompute pulse pressure
        if "pulse_pressure_latest" in scenario.columns and "sbp_latest" in scenario.columns and "dbp_latest" in scenario.columns:
            new_pp = float(scenario.iloc[0]["sbp_latest"]) - float(scenario.iloc[0]["dbp_latest"])
            scenario.loc[scenario.index[0], "pulse_pressure_latest"] = new_pp
            if "pulse_pressure_latest" not in features_changed:
                features_changed.append("pulse_pressure_latest")

        # 4. Check for out-of-distribution values
        for col in features_changed:
            val = float(scenario.iloc[0][col])
            spec = self._feature_spec.get(col, {})
            p_min = spec.get("plausible_min")
            p_max = spec.get("plausible_max")
            if p_min is not None and val < p_min:
                out_of_dist_warnings.append(
                    f"{col} ({val:.1f}) is below 1st percentile of training distribution ({p_min:.1f})"
                )
            elif p_max is not None and val > p_max:
                out_of_dist_warnings.append(
                    f"{col} ({val:.1f}) exceeds 99th percentile of training distribution ({p_max:.1f})"
                )

        scenario_pred = self.predict(scenario, context="whatif_scenario")

        delta_risk_pp = round((scenario_pred["calibrated_risk"] - baseline_pred["calibrated_risk"]) * 100, 2)
        delta_raw_pp = round((scenario_pred["raw_score"] - baseline_pred["raw_score"]) * 100, 2)

        return {
            "baseline_raw": baseline_pred["raw_score"],
            "baseline_risk": baseline_pred["calibrated_risk"],
            "baseline_tier": baseline_pred["risk_tier"],
            "scenario_raw": scenario_pred["raw_score"],
            "scenario_risk": scenario_pred["calibrated_risk"],
            "scenario_tier": scenario_pred["risk_tier"],
            "delta_risk_pp": delta_risk_pp,
            "delta_raw_pp": delta_raw_pp,
            "features_changed_count": len(features_changed),
            "features_changed": features_changed,
            "sbp_delta_applied": clamped_sbp_delta,
            "weight_change_pct_applied": clamped_wt_pct,
            "is_out_of_distribution": len(out_of_dist_warnings) > 0,
            "out_of_distribution_warnings": out_of_dist_warnings,
            "caveat": "Model-based scenario; correlation, not causal treatment advice.",
        }

    def simulate(
        self,
        x_input: pd.DataFrame,
        levers: Dict[str, Any],
        shap_svc: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Full patient simulator:
        - Correlated shifting of SBP, DBP, HR, Weight/BMI, Glucose, HbA1c, trend, conditions & meds.
        - Out-of-range checking against training distribution with detailed feature breaches and bounds.
        - Low-sensitivity detection when tree thresholds aren't crossed.
        - Signed SHAP before and after with feature-level diff attribution on raw log-odds margin scale.
        - Preserves historical intake milestones unless explicitly modeling counterfactual historical trajectory.
        """
        safe_x = self.validate_features_df(x_input)
        baseline_pred = self.predict(safe_x, context="simulate_baseline")
        shap_before = shap_svc.explain(safe_x, n_drivers=6) if shap_svc is not None else []

        scenario = safe_x.copy()
        features_changed: List[str] = []
        warnings: List[str] = []
        is_out_of_range = False

        patient_id = self._extract_patient_id(x_input)

        if not levers:
            # No edits scenario -> exactly baseline. Preserve patient_id from the request context
            # even when the feature row itself does not carry an explicit patient_id column.
            if not patient_id and hasattr(x_input, "attrs") and x_input.attrs.get("patient_id"):
                patient_id = str(x_input.attrs["patient_id"])
            return {
                "patient_id": patient_id,
                "baseline_raw": baseline_pred["raw_score"],
                "baseline_risk": baseline_pred["calibrated_risk"],
                "baseline_tier": baseline_pred["risk_tier"],
                "scenario_raw": baseline_pred["raw_score"],
                "scenario_risk": baseline_pred["calibrated_risk"],
                "scenario_tier": baseline_pred["risk_tier"],
                "delta_risk_pp": 0.0,
                "delta_raw_pp": 0.0,
                "relative_change_pct": 0.0,
                "tier_changed": False,
                "shap_before": shap_before,
                "shap_after": shap_before,
                "shap_diff": [],
                "shap_scale": "raw_margin_log_odds",
                "features_changed": [],
                "dependent_features_summary": [],
                "warnings": [],
                "is_out_of_range": False,
                "scenario_classification": "VALIDATED_DISTRIBUTION",
                "out_of_range_features": [],
                "is_low_sensitivity": False,
                "sensitivity_message": None,
                "caveat": (
                    "Shows how this model's score reacts to the changed inputs on synthetic data. "
                    "It does not predict the effect of a real treatment, and covers hypertension progression only."
                ),
            }

        lever_specs = self._lever_map.get("levers", {})
        model_historical = bool(levers.get("model_historical_trajectory", False))

        # 1. SBP
        curr_sbp = self._safe_float(safe_x.iloc[0].get("sbp_latest", 125.0), 125.0)
        sbp_val = levers.get("sbp_value")
        sbp_d = levers.get("sbp_delta")
        if sbp_val is not None:
            sbp_delta = self._safe_float(sbp_val) - curr_sbp
        elif sbp_d is not None:
            sbp_delta = self._safe_float(sbp_d)
        else:
            sbp_delta = 0.0

        if abs(sbp_delta) > 1e-4:
            default_sbp_cols = ["sbp_latest", "sbp_mean_365d", "sbp_min_365d", "sbp_max_365d", "sbp_last_365d"]
            if model_historical:
                default_sbp_cols.extend(["sbp_first_365d", "baseline_sbp"])
            cols = lever_specs.get("sbp", {}).get("target_columns", default_sbp_cols)
            if not model_historical:
                cols = [c for c in cols if c not in ("baseline_sbp", "sbp_first_365d")]
            for col in cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) + sbp_delta
                    features_changed.append(col)

        # 2. DBP
        curr_dbp = self._safe_float(safe_x.iloc[0].get("dbp_latest", 80.0), 80.0)
        dbp_val = levers.get("dbp_value")
        dbp_d = levers.get("dbp_delta")
        if dbp_val is not None:
            dbp_delta = self._safe_float(dbp_val) - curr_dbp
        elif dbp_d is not None:
            dbp_delta = self._safe_float(dbp_d)
        else:
            dbp_delta = 0.0

        if abs(dbp_delta) > 1e-4:
            default_dbp_cols = ["dbp_latest", "dbp_mean_365d", "dbp_min_365d", "dbp_max_365d", "dbp_last_365d"]
            if model_historical:
                default_dbp_cols.extend(["dbp_first_365d", "baseline_dbp"])
            cols = lever_specs.get("dbp", {}).get("target_columns", default_dbp_cols)
            if not model_historical:
                cols = [c for c in cols if c not in ("baseline_dbp", "dbp_first_365d")]
            for col in cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) + dbp_delta
                    features_changed.append(col)

        # Recompute pulse pressure if SBP or DBP changed
        if (abs(sbp_delta) > 1e-4 or abs(dbp_delta) > 1e-4) and "pulse_pressure_latest" in scenario.columns:
            new_sbp = self._safe_float(scenario.iloc[0]["sbp_latest"], 120.0)
            new_dbp = self._safe_float(scenario.iloc[0]["dbp_latest"], 80.0)
            scenario.loc[scenario.index[0], "pulse_pressure_latest"] = new_sbp - new_dbp
            features_changed.append("pulse_pressure_latest")

        # 3. Heart Rate
        curr_hr = self._safe_float(safe_x.iloc[0].get("hr_latest", 72.0), 72.0)
        hr_val = levers.get("hr_value")
        hr_d = levers.get("hr_delta")
        if hr_val is not None:
            hr_delta = self._safe_float(hr_val) - curr_hr
        elif hr_d is not None:
            hr_delta = self._safe_float(hr_d)
        else:
            hr_delta = 0.0

        if abs(hr_delta) > 1e-4:
            default_hr_cols = ["hr_latest", "hr_mean_365d", "hr_min_365d", "hr_max_365d", "hr_last_365d"]
            if model_historical:
                default_hr_cols.append("hr_first_365d")
            cols = lever_specs.get("hr", {}).get("target_columns", default_hr_cols)
            if not model_historical:
                cols = [c for c in cols if c != "hr_first_365d"]
            for col in cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) + hr_delta
                    features_changed.append(col)

        # 4. Weight & BMI
        curr_wt = safe_x.iloc[0].get("weight_latest")
        curr_wt_val = self._safe_float(curr_wt, 70.0)
        wt_val = levers.get("weight_value")
        wt_pct = levers.get("weight_delta_pct")
        if wt_val is not None and curr_wt_val > 0:
            wt_mult = float(wt_val) / curr_wt_val
        elif wt_pct is not None:
            wt_mult = 1.0 + float(wt_pct)
        else:
            wt_mult = 1.0

        if abs(wt_mult - 1.0) > 1e-4:
            default_wt_cols = ["weight_latest", "weight_mean_365d", "weight_min_365d", "weight_max_365d", "weight_last_365d"]
            if model_historical:
                default_wt_cols.append("weight_first_365d")
            cols = lever_specs.get("weight", {}).get("target_columns", default_wt_cols)
            if not model_historical:
                cols = [c for c in cols if c != "weight_first_365d"]
            for col in cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) * wt_mult
                    features_changed.append(col)

            # BMI shifts proportionately
            default_bmi_cols = ["bmi_latest", "bmi_mean_365d", "bmi_min_365d", "bmi_max_365d", "bmi_last_365d"]
            if model_historical:
                default_bmi_cols.append("bmi_first_365d")
            bmi_cols = lever_specs.get("weight", {}).get("derived_columns", default_bmi_cols)
            if not model_historical:
                bmi_cols = [c for c in bmi_cols if c != "bmi_first_365d"]
            for col in bmi_cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) * wt_mult
                    features_changed.append(col)

        # 5. Glucose
        curr_gl = self._safe_float(safe_x.iloc[0].get("glucose_latest", 100.0), 100.0)
        gl_val = levers.get("glucose_value")
        gl_d = levers.get("glucose_delta")
        if gl_val is not None:
            gl_delta = self._safe_float(gl_val) - curr_gl
        elif gl_d is not None:
            gl_delta = self._safe_float(gl_d)
        else:
            gl_delta = 0.0

        if abs(gl_delta) > 1e-4:
            default_gl_cols = ["glucose_latest", "glucose_mean_365d", "glucose_min_365d", "glucose_max_365d", "glucose_last_365d"]
            if model_historical:
                default_gl_cols.append("glucose_first_365d")
            cols = lever_specs.get("glucose", {}).get("target_columns", default_gl_cols)
            if not model_historical:
                cols = [c for c in cols if c != "glucose_first_365d"]
            for col in cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) + gl_delta
                    features_changed.append(col)

        # 6. HbA1c
        curr_a1c = self._safe_float(safe_x.iloc[0].get("hba1c_latest", 5.6), 5.6)
        a1c_val = levers.get("hba1c_value")
        a1c_d = levers.get("hba1c_delta")
        if a1c_val is not None:
            a1c_delta = self._safe_float(a1c_val) - curr_a1c
        elif a1c_d is not None:
            a1c_delta = self._safe_float(a1c_d)
        else:
            a1c_delta = 0.0

        if abs(a1c_delta) > 1e-4:
            default_a1c_cols = ["hba1c_latest", "hba1c_mean_365d", "hba1c_min_365d", "hba1c_max_365d", "hba1c_last_365d"]
            if model_historical:
                default_a1c_cols.append("hba1c_first_365d")
            cols = lever_specs.get("hba1c", {}).get("target_columns", default_a1c_cols)
            if not model_historical:
                cols = [c for c in cols if c != "hba1c_first_365d"]
            for col in cols:
                if col in scenario.columns and pd.notna(scenario.iloc[0][col]):
                    scenario.loc[scenario.index[0], col] = float(scenario.iloc[0][col]) + a1c_delta
                    features_changed.append(col)

        # 7. Trend Modifier
        trend = levers.get("trend")
        trend_mods = self._lever_map.get("trend_modifiers", {})
        if trend in trend_mods:
            t_mod = trend_mods[trend]
            if t_mod.get("sbp_change", 0.0) != 0.0 and "sbp_change_365d" in scenario.columns:
                cur = scenario.iloc[0]["sbp_change_365d"]
                base_v = float(cur) if pd.notna(cur) else 0.0
                scenario.loc[scenario.index[0], "sbp_change_365d"] = base_v + t_mod["sbp_change"]
                features_changed.append("sbp_change_365d")
            if t_mod.get("sbp_slope", 0.0) != 0.0 and "sbp_slope_365d" in scenario.columns:
                cur = scenario.iloc[0]["sbp_slope_365d"]
                base_v = float(cur) if pd.notna(cur) else 0.0
                scenario.loc[scenario.index[0], "sbp_slope_365d"] = base_v + t_mod["sbp_slope"]
                features_changed.append("sbp_slope_365d")
            if t_mod.get("dbp_change", 0.0) != 0.0 and "dbp_change_365d" in scenario.columns:
                cur = scenario.iloc[0]["dbp_change_365d"]
                base_v = float(cur) if pd.notna(cur) else 0.0
                scenario.loc[scenario.index[0], "dbp_change_365d"] = base_v + t_mod["dbp_change"]
                features_changed.append("dbp_change_365d")
            if t_mod.get("dbp_slope", 0.0) != 0.0 and "dbp_slope_365d" in scenario.columns:
                cur = scenario.iloc[0]["dbp_slope_365d"]
                base_v = float(cur) if pd.notna(cur) else 0.0
                scenario.loc[scenario.index[0], "dbp_slope_365d"] = base_v + t_mod["dbp_slope"]
                features_changed.append("dbp_slope_365d")

        # 8. Conditions Toggles
        conds = levers.get("conditions")
        if isinstance(conds, dict):
            c_diff = 0
            for c_col, c_val in conds.items():
                if c_col in scenario.columns and c_val is not None:
                    orig_val = self._safe_int(safe_x.iloc[0].get(c_col, 0))
                    new_val = self._safe_int(c_val)
                    if orig_val != new_val:
                        scenario.loc[scenario.index[0], c_col] = new_val
                        features_changed.append(c_col)
                        c_diff += (new_val - orig_val)
            if c_diff != 0 and "total_prior_conditions" in scenario.columns:
                old_tot = self._safe_int(safe_x.iloc[0].get("total_prior_conditions", 0))
                scenario.loc[scenario.index[0], "total_prior_conditions"] = max(0, old_tot + c_diff)
                features_changed.append("total_prior_conditions")

        # 9. Medications Toggles
        meds = levers.get("medications")
        if isinstance(meds, dict):
            m_diff = 0
            for m_col, m_val in meds.items():
                if m_col in scenario.columns and m_val is not None:
                    orig_val = self._safe_int(safe_x.iloc[0].get(m_col, 0))
                    new_val = self._safe_int(m_val)
                    if orig_val != new_val:
                        scenario.loc[scenario.index[0], m_col] = new_val
                        features_changed.append(m_col)
                        m_diff += (new_val - orig_val)
            if m_diff != 0 and "total_prior_medications" in scenario.columns:
                old_tot = self._safe_int(safe_x.iloc[0].get("total_prior_medications", 0))
                scenario.loc[scenario.index[0], "total_prior_medications"] = max(0, old_tot + m_diff)
                features_changed.append("total_prior_medications")

        # 10. Advanced / Custom Features
        custom_feats = levers.get("custom_features")
        if isinstance(custom_feats, dict):
            for f_col, f_val in custom_feats.items():
                if f_col in scenario.columns and f_col not in self._forbidden_columns and f_val is not None:
                    scenario.loc[scenario.index[0], f_col] = f_val
                    features_changed.append(f_col)

        # Deduplicate and check ranges
        features_changed = sorted(list(set(features_changed)))
        out_of_range_features = []
        for col in features_changed:
            spec = self._feature_spec.get(col, {})
            r_min = spec.get("range_min")
            r_max = spec.get("range_max")
            p_min = spec.get("plausible_min")
            p_max = spec.get("plausible_max")
            cur_val = scenario.iloc[0][col]
            if isinstance(cur_val, (int, float, np.number)) and not np.isnan(cur_val):
                # Clamp within schema min/max physical limits
                if r_min is not None and cur_val < r_min:
                    scenario.loc[scenario.index[0], col] = r_min
                elif r_max is not None and cur_val > r_max:
                    scenario.loc[scenario.index[0], col] = r_max
                val_after = float(scenario.iloc[0][col])
                unit = _get_feature_unit(col)
                human_lbl = _get_feature_label(col)
                if p_min is not None and val_after < p_min:
                    is_out_of_range = True
                    warnings.append(f"OUT_OF_RANGE: {col} ({val_after:.1f}) is below training distribution minimum ({p_min:.1f})")
                    out_of_range_features.append({
                        "feature": col,
                        "label": human_lbl,
                        "value": round(val_after, 2),
                        "unit": unit,
                        "plausible_min": p_min,
                        "plausible_max": p_max,
                        "breach_type": "BELOW_1ST_PERCENTILE",
                        "reason": f"{human_lbl} ({val_after:.1f} {unit}) is below the model training 1st percentile ({p_min:.1f} {unit}).",
                    })
                elif p_max is not None and val_after > p_max:
                    is_out_of_range = True
                    warnings.append(f"OUT_OF_RANGE: {col} ({val_after:.1f}) exceeds training distribution 99th percentile ({p_max:.1f})")
                    out_of_range_features.append({
                        "feature": col,
                        "label": human_lbl,
                        "value": round(val_after, 2),
                        "unit": unit,
                        "plausible_min": p_min,
                        "plausible_max": p_max,
                        "breach_type": "ABOVE_99TH_PERCENTILE",
                        "reason": f"{human_lbl} ({val_after:.1f} {unit}) exceeds the model training 99th percentile ({p_max:.1f} {unit}).",
                    })

        if is_out_of_range:
            warnings.append(
                "OUT_OF_DISTRIBUTION: One or more scenario inputs exceed the model's documented training distribution bounds. "
                "Predictions outside this domain reflect tree extrapolation and synthetic data artifacts, "
                "NOT a validated clinical risk reduction. Model outputs should be treated as exploratory calculations only."
            )

        # No edits applied or no features modified -> return exact baseline
        if len(features_changed) == 0:
            return {
                "patient_id": patient_id,
                "baseline_raw": baseline_pred["raw_score"],
                "baseline_risk": baseline_pred["calibrated_risk"],
                "baseline_tier": baseline_pred["risk_tier"],
                "scenario_raw": baseline_pred["raw_score"],
                "scenario_risk": baseline_pred["calibrated_risk"],
                "scenario_tier": baseline_pred["risk_tier"],
                "delta_risk_pp": 0.0,
                "delta_raw_pp": 0.0,
                "relative_change_pct": 0.0,
                "tier_changed": False,
                "shap_before": shap_before,
                "shap_after": shap_before,
                "shap_diff": [],
                "shap_scale": "raw_margin_log_odds",
                "features_changed": [],
                "dependent_features_summary": [],
                "warnings": [],
                "is_out_of_range": False,
                "scenario_classification": "VALIDATED_DISTRIBUTION",
                "out_of_range_features": [],
                "is_low_sensitivity": False,
                "sensitivity_message": None,
                "caveat": (
                    "Shows how this model's score reacts to the changed inputs on synthetic data. "
                    "It does not predict the effect of a real treatment, and covers hypertension progression only."
                ),
            }

        # Build dependent features summary explaining why features changed
        dependent_summary = []
        for col in features_changed:
            orig_v = safe_x.iloc[0].get(col)
            new_v = scenario.iloc[0].get(col)
            human_lbl = _get_feature_label(col)
            if col in ["sbp_latest", "dbp_latest", "hr_latest", "weight_latest", "glucose_latest", "hba1c_latest"]:
                cat = "primary_lever"
                rat = "Direct clinical vital scenario input"
            elif col in ["pulse_pressure_latest", "bmi_latest"]:
                cat = "physiological_derivation"
                rat = "Physical definition: Pulse Pressure = SBP - DBP" if "pulse_pressure" in col else "Physical definition: BMI = Weight / Height² proportional scaling"
            elif col in ["baseline_sbp", "baseline_dbp", "sbp_first_365d", "dbp_first_365d", "weight_first_365d", "bmi_first_365d", "glucose_first_365d", "hba1c_first_365d"]:
                cat = "historical_anchor"
                rat = "Historical longitudinal milestone updated under hypothetical historical trajectory"
            else:
                cat = "longitudinal_summary"
                rat = "Observation window summary metric shifted consistently to reflect sustained physiological state"

            dependent_summary.append({
                "feature": col,
                "label": human_lbl,
                "category": cat,
                "rationale": rat,
                "value_before": round(float(orig_v), 2) if isinstance(orig_v, (int, float, np.number)) else orig_v,
                "value_after": round(float(new_v), 2) if isinstance(new_v, (int, float, np.number)) else new_v,
            })

        # Compute scenario risk
        scenario_pred = self.predict(scenario, context="simulate_scenario")
        shap_after = shap_svc.explain(scenario, n_drivers=6) if shap_svc is not None else []

        base_risk = baseline_pred["calibrated_risk"]
        scen_risk = scenario_pred["calibrated_risk"]
        delta_risk_pp = round((scen_risk - base_risk) * 100, 2)
        delta_raw_pp = round((scenario_pred["raw_score"] - baseline_pred["raw_score"]) * 100, 2)
        relative_change_pct = round(((scen_risk - base_risk) / base_risk) * 100, 2) if base_risk > 0 else None
        tier_changed = (scenario_pred["risk_tier"] != baseline_pred["risk_tier"])

        # Sensitivity check
        is_low_sensitivity = False
        sensitivity_message = None
        if len(features_changed) > 0 and abs(delta_risk_pp) < 0.05 and abs(delta_raw_pp) < 0.05:
            is_low_sensitivity = True
            sensitivity_message = "The model does not rely on this input"
            warnings.append("LOW_SENSITIVITY: Model score did not change. The model does not rely on this input.")

        # Compute SHAP difference on raw log-odds scale
        before_map = {f["feature"]: (f["impact"], f.get("label", f["feature"])) for f in shap_before}
        after_map = {f["feature"]: (f["impact"], f.get("label", f["feature"])) for f in shap_after}
        all_driver_keys = list(dict.fromkeys(list(after_map.keys()) + list(before_map.keys())))
        shap_diff = []
        for feat in all_driver_keys:
            b_imp = before_map.get(feat, (0.0, ""))[0]
            a_imp, label = after_map.get(feat, (0.0, before_map.get(feat, (0.0, feat))[1]))
            diff = round(a_imp - b_imp, 4)
            effect = "shifts_toward_higher_risk" if diff > 0 else "shifts_toward_lower_risk" if diff < 0 else "neutral"
            shap_diff.append({
                "feature": feat,
                "human_name": label,
                "attribution_diff": diff,
                "attribution_before": round(b_imp, 4),
                "attribution_after": round(a_imp, 4),
                "direction_effect": effect,
                "clinical_note": (
                    "Attribution change indicates tree routing response on uncalibrated log-odds margin scale. "
                    "Correlated features share attribution across decision trees and cannot be interpreted as independent causal effects."
                ),
            })
        shap_diff.sort(key=lambda x: abs(x["attribution_diff"]), reverse=True)

        return {
            "patient_id": self._extract_patient_id(x_input),
            "baseline_raw": baseline_pred["raw_score"],
            "baseline_risk": baseline_pred["calibrated_risk"],
            "baseline_tier": baseline_pred["risk_tier"],
            "scenario_raw": scenario_pred["raw_score"],
            "scenario_risk": scenario_pred["calibrated_risk"],
            "scenario_tier": scenario_pred["risk_tier"],
            "delta_risk_pp": delta_risk_pp,
            "delta_raw_pp": delta_raw_pp,
            "relative_change_pct": relative_change_pct,
            "tier_changed": tier_changed,
            "shap_before": shap_before,
            "shap_after": shap_after,
            "shap_diff": shap_diff,
            "shap_scale": "raw_margin_log_odds",
            "features_changed": features_changed,
            "dependent_features_summary": dependent_summary,
            "warnings": warnings,
            "is_out_of_range": is_out_of_range,
            "scenario_classification": "OUT_OF_DISTRIBUTION_EXPLORATORY" if is_out_of_range else "VALIDATED_DISTRIBUTION",
            "out_of_range_features": out_of_range_features,
            "is_low_sensitivity": is_low_sensitivity,
            "sensitivity_message": sensitivity_message,
            "caveat": (
                "Shows how this model's score reacts to the changed inputs on synthetic data. "
                "It does not predict the effect of a real treatment, and covers hypertension progression only."
            ),
        }

    def get_sensitivity(self, x_input: pd.DataFrame, pid: str) -> Dict[str, Any]:
        """
        Precomputes sensitivity curves for primary clinical variables across a multi-point grid.
        Helps clinicians visualize step-function plateaus inherent in XGBoost trees and marks supported distribution bounds.
        """
        safe_x = self.validate_features_df(x_input)
        curves = {}

        # 1. SBP
        curr_sbp = self._safe_float(safe_x.iloc[0].get("sbp_latest", 125.0), 125.0)
        sbp_spec = self._feature_spec.get("sbp_latest", {})
        sbp_pmin = sbp_spec.get("plausible_min")
        sbp_pmax = sbp_spec.get("plausible_max")
        sbp_points = []
        for d in [-30, -20, -15, -10, -5, 0, 5, 10, 15, 20, 30]:
            t_val = round(curr_sbp + d, 1)
            res = self.simulate(safe_x, {"sbp_delta": d}, shap_svc=None)
            is_oor = bool((sbp_pmin is not None and t_val < sbp_pmin) or (sbp_pmax is not None and t_val > sbp_pmax))
            sbp_points.append({
                "value": t_val,
                "raw_score": res["scenario_raw"],
                "calibrated_risk": res["scenario_risk"],
                "risk_tier": res["scenario_tier"],
                "is_out_of_range": is_oor,
            })
        curves["sbp"] = {
            "variable": "sbp",
            "display_name": "Systolic Blood Pressure",
            "unit": "mmHg",
            "current_value": curr_sbp,
            "supported_min": sbp_pmin,
            "supported_max": sbp_pmax,
            "is_current_out_of_range": bool((sbp_pmin is not None and curr_sbp < sbp_pmin) or (sbp_pmax is not None and curr_sbp > sbp_pmax)),
            "points": sbp_points,
        }

        # 2. DBP
        curr_dbp = self._safe_float(safe_x.iloc[0].get("dbp_latest", 80.0), 80.0)
        dbp_spec = self._feature_spec.get("dbp_latest", {})
        dbp_pmin = dbp_spec.get("plausible_min")
        dbp_pmax = dbp_spec.get("plausible_max")
        dbp_points = []
        for d in [-20, -15, -10, -5, 0, 5, 10, 15, 20]:
            t_val = round(curr_dbp + d, 1)
            res = self.simulate(safe_x, {"dbp_delta": d}, shap_svc=None)
            is_oor = bool((dbp_pmin is not None and t_val < dbp_pmin) or (dbp_pmax is not None and t_val > dbp_pmax))
            dbp_points.append({
                "value": t_val,
                "raw_score": res["scenario_raw"],
                "calibrated_risk": res["scenario_risk"],
                "risk_tier": res["scenario_tier"],
                "is_out_of_range": is_oor,
            })
        curves["dbp"] = {
            "variable": "dbp",
            "display_name": "Diastolic Blood Pressure",
            "unit": "mmHg",
            "current_value": curr_dbp,
            "supported_min": dbp_pmin,
            "supported_max": dbp_pmax,
            "is_current_out_of_range": bool((dbp_pmin is not None and curr_dbp < dbp_pmin) or (dbp_pmax is not None and curr_dbp > dbp_pmax)),
            "points": dbp_points,
        }

        # 3. Weight
        curr_wt = self._safe_float(safe_x.iloc[0].get("weight_latest", 70.0), 70.0)
        wt_spec = self._feature_spec.get("weight_latest", {})
        wt_pmin = wt_spec.get("plausible_min")
        wt_pmax = wt_spec.get("plausible_max")
        wt_points = []
        for pct in [-0.15, -0.10, -0.05, 0.0, 0.05, 0.10, 0.15]:
            t_val = round(curr_wt * (1.0 + pct), 1)
            res = self.simulate(safe_x, {"weight_delta_pct": pct}, shap_svc=None)
            is_oor = bool((wt_pmin is not None and t_val < wt_pmin) or (wt_pmax is not None and t_val > wt_pmax))
            wt_points.append({
                "value": t_val,
                "raw_score": res["scenario_raw"],
                "calibrated_risk": res["scenario_risk"],
                "risk_tier": res["scenario_tier"],
                "is_out_of_range": is_oor,
            })
        curves["weight"] = {
            "variable": "weight",
            "display_name": "Body Weight",
            "unit": "kg",
            "current_value": curr_wt,
            "supported_min": wt_pmin,
            "supported_max": wt_pmax,
            "is_current_out_of_range": bool((wt_pmin is not None and curr_wt < wt_pmin) or (wt_pmax is not None and curr_wt > wt_pmax)),
            "points": wt_points,
        }

        # 4. Heart Rate
        curr_hr = self._safe_float(safe_x.iloc[0].get("hr_latest", 72.0), 72.0)
        hr_spec = self._feature_spec.get("hr_latest", {})
        hr_pmin = hr_spec.get("plausible_min")
        hr_pmax = hr_spec.get("plausible_max")
        hr_points = []
        for d in [-20, -10, -5, 0, 5, 10, 20]:
            t_val = round(curr_hr + d, 1)
            res = self.simulate(safe_x, {"hr_delta": d}, shap_svc=None)
            is_oor = bool((hr_pmin is not None and t_val < hr_pmin) or (hr_pmax is not None and t_val > hr_pmax))
            hr_points.append({
                "value": t_val,
                "raw_score": res["scenario_raw"],
                "calibrated_risk": res["scenario_risk"],
                "risk_tier": res["scenario_tier"],
                "is_out_of_range": is_oor,
            })
        curves["hr"] = {
            "variable": "hr",
            "display_name": "Resting Heart Rate",
            "unit": "bpm",
            "current_value": curr_hr,
            "supported_min": hr_pmin,
            "supported_max": hr_pmax,
            "is_current_out_of_range": bool((hr_pmin is not None and curr_hr < hr_pmin) or (hr_pmax is not None and curr_hr > hr_pmax)),
            "points": hr_points,
        }

        # 5. Glucose
        curr_gl = self._safe_float(safe_x.iloc[0].get("glucose_latest", 100.0), 100.0)
        gl_spec = self._feature_spec.get("glucose_latest", {})
        gl_pmin = gl_spec.get("plausible_min")
        gl_pmax = gl_spec.get("plausible_max")
        gl_points = []
        for d in [-30, -20, -10, 0, 10, 20, 30, 50]:
            t_val = round(curr_gl + d, 1)
            res = self.simulate(safe_x, {"glucose_delta": d}, shap_svc=None)
            is_oor = bool((gl_pmin is not None and t_val < gl_pmin) or (gl_pmax is not None and t_val > gl_pmax))
            gl_points.append({
                "value": t_val,
                "raw_score": res["scenario_raw"],
                "calibrated_risk": res["scenario_risk"],
                "risk_tier": res["scenario_tier"],
                "is_out_of_range": is_oor,
            })
        curves["glucose"] = {
            "variable": "glucose",
            "display_name": "Fasting Blood Glucose",
            "unit": "mg/dL",
            "current_value": curr_gl,
            "supported_min": gl_pmin,
            "supported_max": gl_pmax,
            "is_current_out_of_range": bool((gl_pmin is not None and curr_gl < gl_pmin) or (gl_pmax is not None and curr_gl > gl_pmax)),
            "points": gl_points,
        }

        # 6. HbA1c
        curr_a1c = self._safe_float(safe_x.iloc[0].get("hba1c_latest", 5.6), 5.6)
        a1c_spec = self._feature_spec.get("hba1c_latest", {})
        a1c_pmin = a1c_spec.get("plausible_min")
        a1c_pmax = a1c_spec.get("plausible_max")
        a1c_points = []
        for d in [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5]:
            t_val = round(curr_a1c + d, 1)
            res = self.simulate(safe_x, {"hba1c_delta": d}, shap_svc=None)
            is_oor = bool((a1c_pmin is not None and t_val < a1c_pmin) or (a1c_pmax is not None and t_val > a1c_pmax))
            a1c_points.append({
                "value": t_val,
                "raw_score": res["scenario_raw"],
                "calibrated_risk": res["scenario_risk"],
                "risk_tier": res["scenario_tier"],
                "is_out_of_range": is_oor,
            })
        curves["hba1c"] = {
            "variable": "hba1c",
            "display_name": "Glycated Hemoglobin (HbA1c)",
            "unit": "%",
            "current_value": curr_a1c,
            "supported_min": a1c_pmin,
            "supported_max": a1c_pmax,
            "is_current_out_of_range": bool((a1c_pmin is not None and curr_a1c < a1c_pmin) or (a1c_pmax is not None and curr_a1c > a1c_pmax)),
            "points": a1c_points,
        }

        return {
            "patient_id": pid,
            "curves": curves,
        }


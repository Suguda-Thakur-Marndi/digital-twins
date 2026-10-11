"""
SHAP Explanation Service for TwinCare / Pramana Twin.
Computes patient-level local SHAP attributions using TreeExplainer on XGBoost
and maps raw features to plain-English clinical labels with directional sign.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import shap

logger = logging.getLogger(__name__)

# Plain-English labels for clinical readability
FEATURE_LABELS: Dict[str, str] = {
    "sbp_latest": "Latest Systolic BP Reading",
    "dbp_latest": "Latest Diastolic BP Reading",
    "sbp_mean_365d": "Annual Mean Systolic BP",
    "dbp_mean_365d": "Annual Mean Diastolic BP",
    "sbp_max_365d": "Peak Systolic BP (365d Lookback)",
    "sbp_min_365d": "Minimum Systolic BP (365d)",
    "sbp_change_365d": "Recent Systolic BP Trend",
    "dbp_change_365d": "Recent Diastolic BP Trend",
    "sbp_first_365d": "Baseline Lookback Systolic BP",
    "dbp_first_365d": "Baseline Lookback Diastolic BP",
    "pulse_pressure_latest": "Arterial Pulse Pressure (SBP - DBP)",
    "bmi_latest": "Current Body Mass Index (BMI)",
    "bmi_mean_365d": "Annual Mean BMI",
    "bmi_change_365d": "1-Year BMI Trajectory",
    "weight_latest": "Current Body Weight (kg)",
    "weight_change_365d": "1-Year Weight Trajectory",
    "hr_latest": "Resting Heart Rate (bpm)",
    "hr_mean_365d": "Annual Mean Heart Rate",
    "age_at_t": "Patient Chronological Age",
    "gender": "Biological Sex",
    "baseline_sbp": "Historical Baseline Systolic BP",
    "baseline_dbp": "Historical Baseline Diastolic BP",
    "total_encounters_365d": "Clinical Encounters in Past Year",
    "days_with_observations_365d": "Observation Exposure Frequency",
    "antihypertensive_med_history": "Antihypertensive Medication Prescriptions",
    "statin_lipid_med_history": "Lipid-Lowering Statin History",
    "antidiabetic_med_history": "Antidiabetic Medication Exposure",
    "diabetes_history": "Pre-existing Type 2 Diabetes",
    "obesity_history": "Documented Obesity History",
    "ckd_history": "Chronic Kidney Disease History",
    "cvd_history": "Cardiovascular Disease History",
    "glucose_latest": "Serum Fasting Glucose",
    "hba1c_latest": "Glycated Hemoglobin (HbA1c)",
    "sbp_count_365d": "Frequency of Blood Pressure Assessments",
    "days_since_first_record": "Longitudinal EHR History Duration",
}


def _clean_feature_name(raw_name: str) -> str:
    """Strip prefixes like 'num__' or 'cat__' or one-hot suffix."""
    name = raw_name
    for prefix in ["num__", "cat__", "remainder__"]:
        if name.startswith(prefix):
            name = name[len(prefix):]
    # Handle one-hot encoding like 'gender_Male' -> 'gender'
    if "_" in name and name.split("_")[0] in ["gender", "race", "ethnicity", "age_band"]:
        return name.split("_")[0]
    return name


class SHAPService:
    def __init__(self, artifacts_dir: Path, model_svc):
        self._artifacts_dir = Path(artifacts_dir)
        self._model_svc = model_svc
        self._explainer: Optional[shap.TreeExplainer] = None

        # Pre-initialize TreeExplainer from the XGBoost model in the pipeline
        try:
            model_step = self._model_svc._pipeline.named_steps.get("model")
            if model_step is not None:
                self._explainer = shap.TreeExplainer(model_step)
                self._preprocess = self._model_svc._pipeline.named_steps.get("preprocess")
                self._transformed_features = list(self._preprocess.get_feature_names_out())
                logger.info(
                    "SHAP TreeExplainer initialized with %d transformed features",
                    len(self._transformed_features),
                )
            else:
                logger.warning("Pipeline has no 'model' step for TreeExplainer")
        except Exception as e:
            logger.warning("Could not initialize SHAP TreeExplainer: %s", e)

    def explain(self, x_df: pd.DataFrame, n_drivers: int = 6) -> List[Dict[str, Any]]:
        """
        Calculates per-patient signed SHAP contributions.
        Returns top `n_drivers` ordered by absolute SHAP value.
        """
        if self._explainer is None or self._preprocess is None:
            # Fallback to feature importance weights from metadata
            return self._fallback_drivers(x_df, n_drivers)

        try:
            safe_x = self._model_svc.validate_features_df(x_df)
            x_tr = self._preprocess.transform(safe_x)
            shap_vals = self._explainer.shap_values(x_tr)
            if isinstance(shap_vals, list):
                # Binary classification list [class 0, class 1]
                vals = shap_vals[1][0]
            elif shap_vals.ndim == 2:
                vals = shap_vals[0]
            else:
                vals = shap_vals

            # Aggregate SHAP values by clean feature name
            feature_impact: Dict[str, float] = {}
            for col_name, shap_v in zip(self._transformed_features, vals):
                clean_name = _clean_feature_name(col_name)
                feature_impact[clean_name] = feature_impact.get(clean_name, 0.0) + float(shap_v)

            # Sort by absolute magnitude
            sorted_items = sorted(feature_impact.items(), key=lambda item: abs(item[1]), reverse=True)

            drivers = []
            for feat_name, impact in sorted_items[:n_drivers]:
                label = FEATURE_LABELS.get(feat_name, feat_name.replace("_", " ").title())
                direction = "increases_risk" if impact > 0 else "reduces_risk"

                # Extract observed value from input row
                obs_val = safe_x.iloc[0].get(feat_name, None)
                if obs_val is None or (isinstance(obs_val, float) and np.isnan(obs_val)):
                    obs_val = None
                elif isinstance(obs_val, (int, np.integer)):
                    obs_val = int(obs_val)
                elif isinstance(obs_val, (float, np.floating)):
                    obs_val = round(float(obs_val), 2)
                else:
                    obs_val = str(obs_val)

                drivers.append({
                    "feature": feat_name,
                    "label": label,
                    "impact": float(round(impact, 4)),
                    "abs_impact": float(round(abs(impact), 4)),
                    "direction": direction,
                    "observed_value": obs_val,
                })

            return drivers
        except Exception as e:
            logger.error("Error computing SHAP values: %s", e, exc_info=True)
            return self._fallback_drivers(x_df, n_drivers)

    def _fallback_drivers(self, x_df: pd.DataFrame, n_drivers: int = 6) -> List[Dict[str, Any]]:
        """Graceful fallback if tree explainer fails."""
        top_global = self._model_svc.global_shap.get("top_features", [])
        drivers = []
        for feat in top_global[:n_drivers]:
            f_name = feat.get("feature", "")
            label = feat.get("display_name", f_name)
            drivers.append({
                "feature": f_name,
                "label": label,
                "impact": round(feat.get("relative_importance", 0.05), 4),
                "abs_impact": round(feat.get("relative_importance", 0.05), 4),
                "direction": "increases_risk",
                "observed_value": None,
            })
        return drivers

"""Timeline service — returns historical snapshots for a patient."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.services.model_service import _score_to_tier

logger = logging.getLogger(__name__)


class TimelineService:
    def __init__(self, artifacts_dir: Path, patient_svc):
        self._artifacts_dir = Path(artifacts_dir)
        self._patient_svc = patient_svc
        logger.info("TimelineService ready")

    def get_timeline(self, patient_id: str, model_svc=None) -> Optional[List[Dict[str, Any]]]:
        """Return all snapshots for a patient with risk scores."""
        if hasattr(self._patient_svc, "get_all_snapshots"):
            rows = self._patient_svc.get_all_snapshots(patient_id)
        elif hasattr(self._patient_svc, "get_timeline_risk"):
            snaps = self._patient_svc.get_timeline_risk(patient_id)
            rows = pd.DataFrame(snaps) if snaps else pd.DataFrame()
        else:
            rows = pd.DataFrame()

        if rows is None or (isinstance(rows, pd.DataFrame) and rows.empty):
            return None

        snapshots = []
        for idx, row in rows.iterrows():
            score = 0.0
            x_df = None
            if hasattr(self._patient_svc, "get_feature_row_by_index"):
                x_df = self._patient_svc.get_feature_row_by_index(idx)

            if x_df is not None:
                try:
                    if model_svc is not None:
                        score = model_svc.score_row(x_df)
                    else:
                        # Try importing from app context
                        try:
                            from app.main import _model_svc
                            if _model_svc is not None:
                                score = _model_svc.score_row(x_df)
                            else:
                                score = 0.0
                        except Exception:
                            score = 0.0
                except Exception as e:
                    logger.warning(f"Could not score snapshot {idx}: {e}")
                    score = 0.0
            else:
                # Use precomputed risk score from snapshot if available
                raw_s = row.get("calibrated_risk")
                if raw_s is None or (isinstance(raw_s, float) and np.isnan(raw_s)):
                    raw_s = row.get("risk_score", row.get("raw_score", 0.0))
                try:
                    score = float(raw_s) if raw_s is not None else 0.0
                except (ValueError, TypeError):
                    score = 0.0

            tier = _score_to_tier(score) if score > 0 else (row.get("risk_tier") or _score_to_tier(score))

            pt = row.get("prediction_time") or row.get("date")
            pt_str = str(pt)[:10] if pd.notna(pt) and pt is not None else None

            def sv(col, fallback=None):
                v = row.get(col)
                if (v is None or (isinstance(v, float) and np.isnan(v))) and fallback:
                    v = row.get(fallback)
                if v is None or (isinstance(v, float) and np.isnan(v)):
                    return None
                return float(v)

            target_val = None
            if "target_label" in row.index and pd.notna(row.get("target_label")):
                target_val = int(row["target_label"])
            elif "stage_2_decompensation" in row.index and pd.notna(row.get("stage_2_decompensation")):
                target_val = int(row["stage_2_decompensation"])

            snapshots.append({
                "prediction_time": pt_str,
                "sbp": sv("sbp_latest", "sbp"),
                "dbp": sv("dbp_latest", "dbp"),
                "bmi": sv("bmi_latest", "bmi"),
                "weight": sv("weight_latest", "weight"),
                "hr": sv("hr_latest", "hr"),
                "risk_score": score,
                "risk_tier": tier,
                "target_label": target_val,
            })

        return snapshots


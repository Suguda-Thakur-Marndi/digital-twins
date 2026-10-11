"""Timeline service — returns historical snapshots for a patient."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class TimelineService:
    def __init__(self, artifacts_dir: Path, patient_svc):
        self._artifacts_dir = Path(artifacts_dir)
        self._patient_svc = patient_svc
        logger.info("TimelineService ready")

    def get_timeline(self, patient_id: str, model_svc=None) -> Optional[List[Dict[str, Any]]]:
        """Return all snapshots for a patient with risk scores."""
        from app.services.model_service import _score_to_tier

        rows = self._patient_svc.get_all_snapshots(patient_id)
        if rows.empty:
            return None

        snapshots = []
        for idx, row in rows.iterrows():
            # Get risk score from feature matrix if available
            x_df = self._patient_svc.get_feature_row_by_index(idx)
            if x_df is None:
                continue

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

            tier = _score_to_tier(score)

            pt = row.get("prediction_time")
            pt_str = str(pt)[:10] if pd.notna(pt) else None

            def sv(col):
                v = row.get(col)
                if v is None or (isinstance(v, float) and np.isnan(v)):
                    return None
                return float(v)

            snapshots.append({
                "prediction_time": pt_str,
                "sbp": sv("sbp_latest"),
                "dbp": sv("dbp_latest"),
                "bmi": sv("bmi_latest"),
                "weight": sv("weight_latest"),
                "hr": sv("hr_latest"),
                "risk_score": score,
                "risk_tier": tier,
                "target_label": int(row["target_label"])
                if "target_label" in row.index and pd.notna(row.get("target_label"))
                else None,
            })

        return snapshots

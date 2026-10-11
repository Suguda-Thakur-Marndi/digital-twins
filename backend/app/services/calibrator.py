"""
Platt Calibrator implementation for TwinCare.
Maps raw XGBoost scores to calibrated empirical probabilities via fitted logistic regression.
"""

from __future__ import annotations
import numpy as np


class PlattCalibratorWrapper:
    """Wrapper that maps raw model scores to calibrated probabilities."""

    def __init__(self, coef: float, intercept: float):
        self.coef = float(coef)
        self.intercept = float(intercept)

    def calibrate(self, raw_proba: float | np.ndarray) -> float | np.ndarray:
        raw_arr = np.asarray(raw_proba, dtype=float)
        clipped = np.clip(raw_arr, 1e-6, 1.0 - 1e-6)
        z = np.log(clipped / (1.0 - clipped))
        logit_cal = self.coef * z + self.intercept
        cal = 1.0 / (1.0 + np.exp(-logit_cal))
        if np.ndim(raw_proba) == 0:
            return float(cal)
        return cal

    def predict_proba(self, raw_proba: float | np.ndarray) -> np.ndarray:
        cal = self.calibrate(raw_proba)
        if np.ndim(cal) == 0:
            return np.array([1.0 - float(cal), float(cal)])
        return np.column_stack([1.0 - cal, cal])

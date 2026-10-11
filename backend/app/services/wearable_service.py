"""
Wearable Simulation & Live Telemetry Streaming Service
Generates deterministic simulated wearable telemetry (daily resting HR, steps, home BP, SpO2, sleep)
derived from the patient's clinical baseline using a seeded pseudo-random generator.
Computes 7-day rolling summary features with variability (standard deviation).
Evaluates clinical alert rules (e.g., home SBP >= 140 on 5 of 7 days).
Maintains live stream buffers and pub-sub queues for SSE broadcasting.
Always explicitly marks data with simulated: true.
"""

from __future__ import annotations

import asyncio
import hashlib
import random
from collections import deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import numpy as np


class WearableService:
    """Generates reproducible, deterministic simulated wearable feeds and manages live streaming."""

    def __init__(self):
        # In-memory buffer for live stream readings per patient
        self._live_readings: Dict[str, deque[Dict[str, Any]]] = {}
        # SSE listener queues per patient
        self._listeners: Dict[str, List[asyncio.Queue]] = {}

    def _get_live_queue(self, patient_id: str) -> deque[Dict[str, Any]]:
        if patient_id not in self._live_readings:
            self._live_readings[patient_id] = deque(maxlen=60)
        return self._live_readings[patient_id]

    def evaluate_alert_rules(self, readings: List[Dict[str, Any]]) -> List[str]:
        """
        Clinical alert rules for out-of-office home telemetry:
        1. Home SBP >= 140 on >= 5 of last 7 days (Uncontrolled Out-of-Office Hypertension)
        2. Home DBP >= 90 on >= 5 of last 7 days (Stage 2 Diastolic Alert)
        3. Mean resting HR > 100 bpm (Resting Tachycardia)
        4. Home SBP standard deviation > 12 mmHg (Excessive BP Variability)
        5. Nocturnal SpO2 < 93% (Intermittent Desaturation Alert)
        """
        flags: List[str] = []
        if not readings:
            return flags

        last_7 = readings[-7:]

        # Rule 1 & 2: Sustained elevated home BP on 5 of 7 days
        sbp_elevated_days = sum(1 for r in last_7 if r.get("home_sbp_mean", 0) >= 140.0)
        dbp_elevated_days = sum(1 for r in last_7 if r.get("home_dbp_mean", 0) >= 90.0)

        if sbp_elevated_days >= 5:
            flags.append(
                f"FLAG: Home SBP ≥ 140 mmHg on {sbp_elevated_days} of 7 days (Uncontrolled Out-of-Office Hypertension - IGH-IV Stage 2)"
            )
        elif sbp_elevated_days >= 3:
            flags.append(
                f"NOTICE: Elevated Home SBP (≥ 140 mmHg on {sbp_elevated_days} of 7 days)"
            )

        if dbp_elevated_days >= 5:
            flags.append(
                f"FLAG: Home DBP ≥ 90 mmHg on {dbp_elevated_days} of 7 days (Sustained Diastolic Load)"
            )

        # Rule 3: Resting Tachycardia
        recent_hrs = [r.get("resting_heart_rate", 72.0) for r in last_7]
        avg_hr = np.mean(recent_hrs) if recent_hrs else 72.0
        if avg_hr > 100.0:
            flags.append(f"FLAG: Persistent Resting Tachycardia (7-day mean: {avg_hr:.1f} bpm)")

        # Rule 4: Excessive BP Variability
        recent_sbps = [r.get("home_sbp_mean", 125.0) for r in last_7]
        if len(recent_sbps) >= 3:
            sbp_std = float(np.std(recent_sbps))
            if sbp_std > 12.0:
                flags.append(f"FLAG: High Blood Pressure Variability (7-day SD: {sbp_std:.1f} mmHg > 12.0 threshold)")

        # Rule 5: Nocturnal SpO2 desaturation
        spo2_dips = [r.get("spo2_percent", 98.0) for r in last_7 if r.get("spo2_percent", 98.0) < 93.0]
        if spo2_dips:
            flags.append(f"FLAG: Nocturnal Oxygen Desaturation detected (Lowest SpO2: {min(spo2_dips):.1f}%)")

        return flags

    def simulate_feed(
        self,
        patient_id: str,
        baseline_hr: Optional[float] = 72.0,
        baseline_sbp: Optional[float] = 125.0,
        baseline_dbp: Optional[float] = 82.0,
        days: int = 14,
    ) -> Dict[str, Any]:
        """
        Generate deterministic wearable stream seeded by patient_id with 7-day summary features.
        Every response explicitly sets simulated: True.
        """
        seed_int = int(hashlib.md5(patient_id.encode()).hexdigest()[:8], 16)
        rng = random.Random(seed_int)

        base_hr = float(baseline_hr) if baseline_hr is not None else 72.0
        base_sbp = float(baseline_sbp) if baseline_sbp is not None else 125.0
        base_dbp = float(baseline_dbp) if baseline_dbp is not None else 82.0

        today = datetime.now()
        readings: List[Dict[str, Any]] = []

        for d in range(days - 1, -1, -1):
            date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
            day_of_week = (today - timedelta(days=d)).weekday()
            is_weekend = day_of_week >= 5

            hr_noise = rng.gauss(0, 3.2)
            daily_resting_hr = round(max(52.0, min(105.0, base_hr + hr_noise)), 1)

            step_base = 8200 if is_weekend else 7100
            daily_steps = int(max(2100, rng.gauss(step_base, 1400)))

            home_sbp_morning = round(max(95.0, min(190.0, base_sbp - 3.0 + rng.gauss(0, 5.0))), 1)
            home_dbp_morning = round(max(60.0, min(120.0, base_dbp - 2.0 + rng.gauss(0, 4.0))), 1)
            home_sbp_evening = round(max(95.0, min(190.0, base_sbp - 1.0 + rng.gauss(0, 5.5))), 1)
            home_dbp_evening = round(max(60.0, min(120.0, base_dbp - 1.0 + rng.gauss(0, 4.2))), 1)

            sleep_hours = round(max(4.5, min(9.5, rng.gauss(7.1, 0.9))), 1)
            spo2 = round(max(92.0, min(99.0, rng.gauss(97.2, 1.1))), 1)

            mean_sbp = round((home_sbp_morning + home_sbp_evening) / 2.0, 1)
            mean_dbp = round((home_dbp_morning + home_dbp_evening) / 2.0, 1)

            readings.append({
                "date": date_str,
                "resting_heart_rate": daily_resting_hr,
                "daily_steps": daily_steps,
                "home_bp_morning": f"{int(home_sbp_morning)}/{int(home_dbp_morning)}",
                "home_bp_evening": f"{int(home_sbp_evening)}/{int(home_dbp_evening)}",
                "home_sbp_mean": mean_sbp,
                "home_dbp_mean": mean_dbp,
                "sleep_hours": sleep_hours,
                "spo2_percent": spo2,
                "simulated": True,
            })

        # Append any dynamic live readings that arrived for this patient
        live_buf = self._get_live_queue(patient_id)
        if live_buf:
            for item in live_buf:
                readings.append(item)

        # 7-day rolling window
        last_7 = readings[-7:]
        last_7_sbp = [r["home_sbp_mean"] for r in last_7]
        last_7_dbp = [r["home_dbp_mean"] for r in last_7]
        last_7_hr = [r["resting_heart_rate"] for r in last_7]
        last_7_steps = [r["daily_steps"] for r in last_7]
        last_7_sleep = [r["sleep_hours"] for r in last_7]
        last_7_spo2 = [r["spo2_percent"] for r in last_7]

        summary = {
            "avg_resting_hr": round(float(np.mean(last_7_hr)), 1),
            "resting_hr_std": round(float(np.std(last_7_hr)), 1),
            "avg_daily_steps": int(np.mean(last_7_steps)),
            "avg_home_sbp": round(float(np.mean(last_7_sbp)), 1),
            "home_sbp_std": round(float(np.std(last_7_sbp)), 1),
            "avg_home_dbp": round(float(np.mean(last_7_dbp)), 1),
            "home_dbp_std": round(float(np.std(last_7_dbp)), 1),
            "avg_sleep_hours": round(float(np.mean(last_7_sleep)), 1),
            "avg_spo2": round(float(np.mean(last_7_spo2)), 1),
        }

        alert_flags = self.evaluate_alert_rules(readings)

        return {
            "patient_id": patient_id,
            "simulated": True,
            "tag": "SIMULATED",
            "days_count": len(readings),
            "summary": summary,
            "alert_flags": alert_flags,
            "daily_readings": readings,
            "disclaimer": (
                "SIMULATED WEARABLE STREAM: Continuous ambulatory sensor readings (resting HR, "
                "daily steps, home BP, sleep, SpO2) are generated as an adjustable demonstration overlay. "
                "The trained 132-feature XGBoost model uses rolling EHR encounters and does NOT consume raw wearable feeds."
            ),
        }

    def add_stream_reading(
        self,
        patient_id: str,
        sbp: Optional[float] = None,
        dbp: Optional[float] = None,
        hr: Optional[float] = None,
        spo2: Optional[float] = None,
        steps: Optional[int] = None,
        reading_type: str = "bp",
    ) -> Dict[str, Any]:
        """
        Ingest a live telemetry reading into the patient's simulated stream.
        Notifies connected SSE listeners.
        """
        now = datetime.now()
        entry = {
            "date": now.strftime("%Y-%m-%d %H:%M:%S"),
            "reading_type": reading_type,
            "resting_heart_rate": hr if hr is not None else round(random.uniform(68.0, 78.0), 1),
            "daily_steps": steps if steps is not None else random.randint(4000, 9500),
            "home_sbp_mean": sbp if sbp is not None else round(random.uniform(120.0, 138.0), 1),
            "home_dbp_mean": dbp if dbp is not None else round(random.uniform(76.0, 88.0), 1),
            "sleep_hours": round(random.uniform(6.5, 8.2), 1),
            "spo2_percent": spo2 if spo2 is not None else round(random.uniform(96.0, 99.0), 1),
            "simulated": True,
        }

        buf = self._get_live_queue(patient_id)
        buf.append(entry)

        # Notify any active SSE subscribers
        if patient_id in self._listeners:
            for q in list(self._listeners[patient_id]):
                try:
                    q.put_nowait(entry)
                except Exception:
                    pass

        # Compute updated summary
        all_readings = list(buf)
        last_7_sbp = [r["home_sbp_mean"] for r in all_readings]
        last_7_dbp = [r["home_dbp_mean"] for r in all_readings]
        last_7_hr = [r["resting_heart_rate"] for r in all_readings]

        summary = {
            "avg_resting_hr": round(float(np.mean(last_7_hr)), 1),
            "avg_home_sbp": round(float(np.mean(last_7_sbp)), 1),
            "home_sbp_std": round(float(np.std(last_7_sbp)), 1) if len(last_7_sbp) > 1 else 0.0,
            "avg_home_dbp": round(float(np.mean(last_7_dbp)), 1),
            "home_dbp_std": round(float(np.std(last_7_dbp)), 1) if len(last_7_dbp) > 1 else 0.0,
        }

        flags = self.evaluate_alert_rules(all_readings)

        return {
            "patient_id": patient_id,
            "simulated": True,
            "reading_accepted": True,
            "reading_logged": entry,
            "wearable_summary": summary,
            "alert_flags": flags,
            "updated_vitals": {
                "sbp": entry["home_sbp_mean"],
                "dbp": entry["home_dbp_mean"],
                "hr": entry["resting_heart_rate"],
            },
            "disclaimer": "Simulated wearable telemetry layer — decoupled from ML weights.",
        }

    def subscribe(self, patient_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        if patient_id not in self._listeners:
            self._listeners[patient_id] = []
        self._listeners[patient_id].append(q)
        return q

    def unsubscribe(self, patient_id: str, q: asyncio.Queue):
        if patient_id in self._listeners and q in self._listeners[patient_id]:
            self._listeners[patient_id].remove(q)

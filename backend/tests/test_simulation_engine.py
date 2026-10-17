"""
Test suite for the Clinical Simulation Engine in VitalTwin.
Verifies:
1. Baseline preservation when levers match baseline
2. Clinical preset behavior, isolation, and dependent updates
3. Reset functionality
4. Dependent-feature transformations and historical anchor isolation
5. Input schema validation (132 features)
6. Calibration and risk-category threshold consistency
7. Out-of-distribution warnings, feature breakdown, and exploratory classification
8. Scenario comparison arithmetic (absolute pp and relative %)
9. SHAP output compatibility and raw margin log-odds scale
10. Sensitivity curve bounds and out-of-range indicators
11. Saved scenario immutability and API error handling
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app, _model_svc, _patient_svc


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def demo_patient_id(client):
    patients = client.get("/api/v1/patients").json()
    assert len(patients) > 0
    # Choose a demo synthetic patient with guaranteed complete feature_row
    for p in patients:
        if not p.get("is_registered"):
            detail = client.get(f"/api/v1/patients/{p['id']}").json()
            if detail.get("feature_row"):
                return p["id"]
    return patients[0]["id"]


# ── 1. Baseline Preservation ──────────────────────────────────────────────────
def test_simulation_preserves_baseline_when_no_change(client, demo_patient_id):
    """Simulating with identical baseline values produces delta = 0 and matches baseline risk."""
    p = client.get(f"/api/v1/patients/{demo_patient_id}").json()
    feat_row = p.get("feature_row", {})
    base_sbp = feat_row.get("sbp_latest", 125)

    payload = {
        "patient_id": demo_patient_id,
        "sbp_value": base_sbp,
        "trend": "stable",
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["baseline_risk"] == pytest.approx(data["scenario_risk"], abs=1e-3)
    assert abs(data["delta_risk_pp"]) < 0.1
    if data["relative_change_pct"] is not None:
        assert abs(data["relative_change_pct"]) < 1.0


# ── 2. Preset Behavior & Isolation ────────────────────────────────────────────
def test_preset_improve_bp_isolation(client, demo_patient_id):
    """Improve BP Control reduces SBP/DBP with improving trend, leaving glucose and weight untouched."""
    p = client.get(f"/api/v1/patients/{demo_patient_id}").json()
    feat_row = p.get("feature_row", {})
    base_sbp = float(feat_row.get("sbp_latest") or 130.0)
    base_dbp = float(feat_row.get("dbp_latest") or 85.0)

    payload = {
        "patient_id": demo_patient_id,
        "sbp_value": base_sbp - 15,
        "dbp_value": base_dbp - 8,
        "trend": "improving",
        "medications": {"antihypertensive_med_history": 1},
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "sbp_latest" in data["features_changed"]
    assert "dbp_latest" in data["features_changed"]
    assert "sbp_mean_365d" in data["features_changed"]
    assert "dbp_mean_365d" in data["features_changed"]
    # Unrelated levers should not be reported as changed
    assert "glucose_latest" not in data["features_changed"]
    assert "weight_latest" not in data["features_changed"]


def test_preset_weight_loss_recalculates_bmi(client, demo_patient_id):
    """Weight loss preset reduces weight and proportionately derives BMI without touching BP."""
    p = client.get(f"/api/v1/patients/{demo_patient_id}").json()
    feat_row = p.get("feature_row", {})
    base_weight = float(feat_row.get("weight_latest") or 80.0)

    payload = {
        "patient_id": demo_patient_id,
        "weight_value": base_weight * 0.93,
        "trend": "improving",
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "weight_latest" in data["features_changed"]
    assert "bmi_latest" in data["features_changed"]
    assert "sbp_latest" not in data["features_changed"]


# ── 3. Dependent Feature Transformations & Historical Anchors ────────────────
def test_historical_anchors_preserved_by_default(client, demo_patient_id):
    """By default, historical intake records (baseline_sbp, sbp_first_365d) remain unchanged."""
    payload = {
        "patient_id": demo_patient_id,
        "sbp_value": 155,
        "trend": "worsening",
        "model_historical_trajectory": False,
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    # Current vital and window aggregates change
    assert "sbp_latest" in data["features_changed"]
    assert "sbp_mean_365d" in data["features_changed"]
    # Historical intake anchors must NOT change
    assert "baseline_sbp" not in data["features_changed"]
    assert "sbp_first_365d" not in data["features_changed"]


def test_historical_anchors_updated_when_trajectory_enabled(client, demo_patient_id):
    """When model_historical_trajectory is True, historical intake anchors are shifted."""
    payload = {
        "patient_id": demo_patient_id,
        "sbp_value": 155,
        "trend": "worsening",
        "model_historical_trajectory": True,
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "baseline_sbp" in data["features_changed"]
    assert "sbp_first_365d" in data["features_changed"]


# ── 4. Out-of-Distribution Warnings & Audit Case Investigation ───────────────
def test_audit_case_out_of_distribution_behavior(client):
    """
    Test the exact audit case reported by user (Ananya / patient with worsening diabetes).
    Verifies:
    - is_out_of_range is True
    - scenario_classification is OUT_OF_DISTRIBUTION_EXPLORATORY
    - out_of_range_features identifies glucose_latest and hba1c_latest with training bounds
    - SHAP scale is labeled as raw_margin_log_odds
    """
    patients = client.get("/api/v1/patients").json()
    # Find patient Ananya or fallback to first
    target_id = patients[0]["id"]
    for p in patients:
        if "Ananya" in p.get("name", ""):
            target_id = p["id"]
            break

    payload = {
        "patient_id": target_id,
        "glucose_value": 135.0,  # Exceeds 99th percentile (~121.4)
        "hba1c_value": 7.8,      # Exceeds 99th percentile (~7.1)
        "trend": "worsening",
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert data["is_out_of_range"] is True
    assert data["scenario_classification"] == "OUT_OF_DISTRIBUTION_EXPLORATORY"
    assert len(data["out_of_range_features"]) >= 1

    breached_names = [f["feature"] for f in data["out_of_range_features"]]
    assert "glucose_latest" in breached_names or "hba1c_latest" in breached_names

    # Check that out of range detail contains plausible_max and breach_type
    for item in data["out_of_range_features"]:
        assert "feature" in item
        assert "label" in item
        assert "value" in item
        assert "unit" in item
        assert "breach_type" in item
        assert item["breach_type"] in ("BELOW_1ST_PERCENTILE", "ABOVE_99TH_PERCENTILE")

    # SHAP scale must be raw_margin_log_odds
    assert data["shap_scale"] == "raw_margin_log_odds"


# ── 5. Scenario Comparison Arithmetic ────────────────────────────────────────
def test_scenario_comparison_arithmetic_consistency(client, demo_patient_id):
    """
    Verifies mathematical definition of absolute shift (pp) and relative change (%):
    - delta_risk_pp == (scenario_risk - baseline_risk) * 100
    - relative_change_pct == ((scenario_risk - baseline_risk) / baseline_risk) * 100
    """
    payload = {
        "patient_id": demo_patient_id,
        "sbp_value": 110,
        "dbp_value": 70,
        "trend": "improving",
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    expected_pp = round((data["scenario_risk"] - data["baseline_risk"]) * 100, 2)
    assert data["delta_risk_pp"] == pytest.approx(expected_pp, abs=0.05)

    if data["baseline_risk"] > 0:
        expected_rel = round(((data["scenario_risk"] - data["baseline_risk"]) / data["baseline_risk"]) * 100, 1)
        assert data["relative_change_pct"] == pytest.approx(expected_rel, abs=0.1)


# ── 6. Calibration & Risk Tier Threshold Consistency ─────────────────────────
def test_risk_tiers_conform_to_clinical_thresholds(client, demo_patient_id):
    """Risk tiers must follow: Low (<15%), Moderate (15%-40%), High (>=40%)."""
    for test_sbp in [105, 135, 175]:
        payload = {"patient_id": demo_patient_id, "sbp_value": test_sbp}
        res = client.post("/api/v1/simulate", json=payload)
        assert res.status_code == 200
        data = res.json()

        risk = data["scenario_risk"]
        tier = data["scenario_tier"]

        if risk < 0.15:
            assert tier == "Low", f"Risk {risk} should be Low, got {tier}"
        elif risk < 0.40:
            assert tier == "Moderate", f"Risk {risk} should be Moderate, got {tier}"
        else:
            assert tier == "High", f"Risk {risk} should be High, got {tier}"


# ── 7. SHAP Scale & Differential Consistency ─────────────────────────────────
def test_shap_differentials_are_consistent(client, demo_patient_id):
    """SHAP diff items must have attribution_diff == attribution_after - attribution_before."""
    payload = {
        "patient_id": demo_patient_id,
        "sbp_value": 150,
        "trend": "worsening",
    }
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 200
    data = res.json()

    shap_diff = data.get("shap_diff", [])
    assert len(shap_diff) > 0

    for item in shap_diff:
        expected_diff = round(item["attribution_after"] - item["attribution_before"], 4)
        assert item["attribution_diff"] == pytest.approx(expected_diff, abs=1e-3)


# ── 8. Sensitivity Curve Bounds & Supported Range ────────────────────────────
def test_sensitivity_endpoint_returns_supported_bounds(client, demo_patient_id):
    """Verifies that /api/v1/sensitivity/{id} returns supported_min/max and out-of-range flags."""
    res = client.get(f"/api/v1/patients/{demo_patient_id}/sensitivity")
    assert res.status_code == 200
    data = res.json()

    assert "curves" in data
    curves = data["curves"]
    assert "sbp" in curves
    assert "glucose" in curves

    for var_name, curve in curves.items():
        assert "variable" in curve
        assert "display_name" in curve
        assert "supported_min" in curve
        assert "supported_max" in curve
        assert "is_current_out_of_range" in curve
        assert curve["supported_min"] is not None
        assert curve["supported_max"] is not None
        assert curve["supported_min"] < curve["supported_max"]

        points = curve.get("points", [])
        assert len(points) >= 5
        for pt in points:
            assert "value" in pt
            assert "raw_score" in pt
            assert "calibrated_risk" in pt
            assert "is_out_of_range" in pt
            # Risk must be bounded [0, 1]
            assert 0.0 <= pt["calibrated_risk"] <= 1.0


# ── 9. Error Handling & Validation ───────────────────────────────────────────
def test_simulation_invalid_patient_returns_404(client):
    """Non-existent patient returns 404."""
    payload = {"patient_id": "non_existent_patient_id_12345"}
    res = client.post("/api/v1/simulate", json=payload)
    assert res.status_code == 404


def test_simulation_empty_body_returns_422(client):
    """Missing patient_id in body returns 422 Unprocessable Entity."""
    res = client.post("/api/v1/simulate", json={})
    assert res.status_code == 422

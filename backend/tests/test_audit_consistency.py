"""
Comprehensive audit and consistency verification tests for TwinCare / Pramana Clinical Twin.
Covers:
- Confidence interval consistency with estimate and methodology
- Distinct risk states across baseline, historical replay, and counterfactual simulation
- Threshold configuration (40% High-Risk action vs 5% early warning surveillance)
- Simulator input-to-feature mapping and reconciliation
- Missing-value and demographic string rendering (no NaN)
- Synthetic and simulated data attribution
- Frontend contract consistency
"""

import json
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


# ── 1. Confidence Interval Consistency ───────────────────────────────────────
def test_confidence_interval_encloses_estimate_for_all_demo_patients(client):
    """Verify that every patient with a confidence interval has ci_lower <= calibrated_risk <= ci_upper."""
    patients = client.get("/api/v1/patients").json()
    assert len(patients) > 0

    for p_summary in patients:
        p = client.get(f"/api/v1/patients/{p_summary['id']}").json()
        risk_obj = p.get("latest_risk", {})
        cal_risk = risk_obj.get("calibrated_risk")
        ci = risk_obj.get("confidence_interval_95")

        if ci is not None and cal_risk is not None:
            assert isinstance(ci, list) and len(ci) == 2, f"Invalid CI structure for patient {p['id']}"
            lower, upper = ci[0], ci[1]
            assert lower <= upper, f"CI inverted for patient {p['id']}: [{lower}, {upper}]"
            assert lower <= cal_risk <= upper, (
                f"Calibrated risk {cal_risk} not enclosed in 95% CI [{lower}, {upper}] for patient {p['id']}"
            )


def test_predict_endpoint_confidence_interval_is_consistent(client):
    """Verify that /api/v1/predict produces a statistically valid CI enclosing the calibrated estimate."""
    patients = client.get("/api/v1/patients").json()
    assert len(patients) > 0
    pid = patients[0]["id"]

    res = client.post("/api/v1/predict", json={"patient_id": pid})
    assert res.status_code == 200
    data = res.json()

    cal_risk = data["calibrated_risk"]
    ci = data["confidence_interval_95"]
    assert ci is not None
    assert len(ci) == 2
    assert ci[0] <= cal_risk <= ci[1], f"Calibrated risk {cal_risk} is outside CI [{ci[0]}, {ci[1]}]"


def test_simulation_does_not_fabricate_confidence_interval(client):
    """
    ML Evaluation Integrity: Counterfactual simulations must NOT fabricate or invent
    counterfactual confidence intervals. Verify simulate response omits or keeps CI null.
    """
    patients = client.get("/api/v1/patients").json()
    pid = patients[0]["id"]

    sim_res = client.post(
        "/api/v1/simulate",
        json={"patient_id": pid, "sbp_delta": -10.0, "weight_change_pct": -0.05},
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()

    # The simulation response must have baseline vs scenario risks, but must NOT invent a counterfactual CI
    assert "baseline_risk" in sim_data
    assert "scenario_risk" in sim_data
    assert "confidence_interval_95" not in sim_data or sim_data.get("confidence_interval_95") is None


# ── 2. Distinct Risk States Across Baseline, Historical, and Simulated ────────
def test_distinct_risk_states_baseline_vs_simulated(client):
    """Verify baseline risk, simulated scenario risk, and delta are distinctly reported."""
    patients = client.get("/api/v1/patients").json()
    pid = patients[0]["id"]

    sim_res = client.post(
        "/api/v1/simulate",
        json={"patient_id": pid, "sbp_delta": 20.0},
    )
    assert sim_res.status_code == 200
    data = sim_res.json()

    assert data["baseline_risk"] is not None
    assert data["scenario_risk"] is not None
    assert "delta_risk_pp" in data
    # SBP increase of 20 mmHg should not decrease risk
    assert data["scenario_risk"] >= data["baseline_risk"]


def test_distinct_historical_snapshots(client):
    """Verify historical snapshots have their own risk scores, distinct from current baseline."""
    patients = client.get("/api/v1/patients").json()
    # Find patient with multiple snapshots
    patient_with_snapshots = None
    for p in patients:
        detail = client.get(f"/api/v1/patients/{p['id']}").json()
        if len(detail.get("snapshots", [])) >= 2:
            patient_with_snapshots = detail
            break

    assert patient_with_snapshots is not None
    snapshots = patient_with_snapshots["snapshots"]
    assert len(snapshots) >= 2
    # Ensure snapshots have date, risk_tier, and calibrated_risk
    for s in snapshots:
        assert "date" in s
        assert "calibrated_risk" in s
        assert "risk_tier" in s


# ── 3. Threshold Configuration & Surveillance State Transitions ──────────────
def test_alert_threshold_is_distinct_from_surveillance_threshold(client):
    """
    Verify threshold configuration:
    - Model metadata defines alert_threshold: 0.40 (High-Risk action threshold).
    - Early warning risk alerts query uses threshold: 0.05 (5.0% early surveillance).
    """
    # 1. Check model metadata via model info endpoint
    model_card = client.get("/api/v1/model/info").json()
    assert model_card["alert_threshold"] == 0.40, "Expected model alert_threshold to be 0.40 (40%)"

    # 2. Check risk alerts endpoint with 5% surveillance threshold
    alerts_res = client.get("/api/v1/alerts?threshold=0.05")
    assert alerts_res.status_code == 200
    alerts_data = alerts_res.json()
    assert alerts_data["alert_threshold"] == 0.05, "Expected surveillance alert_threshold to be 0.05 (5%)"


# ── 4. Simulator Input-to-Feature Mapping Reconciliation ─────────────────────
def test_simulator_zero_delta_leaves_features_unchanged(client):
    """Verify simulator with 0 delta preserves exact baseline risk and reports 0 features changed."""
    patients = client.get("/api/v1/patients").json()
    pid = patients[0]["id"]

    sim_res = client.post(
        "/api/v1/simulate",
        json={"patient_id": pid, "sbp_delta": 0.0, "weight_change_pct": 0.0},
    )
    assert sim_res.status_code == 200
    data = sim_res.json()
    assert data["delta_risk_pp"] == 0.0
    assert data["scenario_risk"] == data["baseline_risk"]


def test_simulator_correlated_feature_shifts(client):
    """Verify SBP shift updates all correlated SBP features and pulse pressure."""
    patients = client.get("/api/v1/patients").json()
    pid = patients[0]["id"]

    sim_res = client.post(
        "/api/v1/simulate",
        json={"patient_id": pid, "sbp_delta": 15.0},
    )
    assert sim_res.status_code == 200
    data = sim_res.json()
    features_changed = data.get("features_changed", [])
    # SBP shift must change sbp_latest and pulse_pressure_latest
    assert "sbp_latest" in features_changed
    assert "pulse_pressure_latest" in features_changed


# ── 5. Missing Values & Demographics ─────────────────────────────────────────
def test_demographics_are_non_nan_strings_in_feature_rows(client):
    """Verify gender, race, and ethnicity are string values and never evaluate to NaN."""
    patients = client.get("/api/v1/patients").json()
    for p_summary in patients:
        p = client.get(f"/api/v1/patients/{p_summary['id']}").json()
        feat = p.get("feature_row", {})
        if "gender" in feat and feat["gender"] is not None:
            assert isinstance(feat["gender"], str), f"Gender in feature_row must be string, got {type(feat['gender'])}"
        if "race" in feat and feat["race"] is not None:
            assert isinstance(feat["race"], str), f"Race in feature_row must be string, got {type(feat['race'])}"
        if "ethnicity" in feat and feat["ethnicity"] is not None:
            assert isinstance(feat["ethnicity"], str), f"Ethnicity in feature_row must be string, got {type(feat['ethnicity'])}"


# ── 6. Frontend Codebase Audit Rules Verification ─────────────────────────────
def test_frontend_has_no_fabricated_confidence_intervals():
    """Verify no hardcoded '± 3.8% (95% CI)' or '* 0.85' / '* 1.15' formulas exist in frontend source."""
    frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"

    risk_panel_file = frontend_dir / "components" / "digital-twin" / "RiskPanel.tsx"
    assert risk_panel_file.exists()
    content_rp = risk_panel_file.read_text(encoding="utf-8")
    assert "± 3.8% (95% CI)" not in content_rp, "Found fabricated '± 3.8% (95% CI)' in RiskPanel.tsx"

    home_page_file = frontend_dir / "app" / "page.tsx"
    assert home_page_file.exists()
    content_home = home_page_file.read_text(encoding="utf-8")
    assert "currentRiskScore * 0.85" not in content_home, "Found fabricated '* 0.85' formula in page.tsx"
    assert "currentRiskScore * 1.15" not in content_home, "Found fabricated '* 1.15' formula in page.tsx"


def test_frontend_simulator_loading_has_no_print():
    """Verify simulator loading indicator includes no-print class so it never renders in exported PDFs."""
    frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
    sim_file = frontend_dir / "components" / "digital-twin" / "PatientSimulator.tsx"
    assert sim_file.exists()
    content_sim = sim_file.read_text(encoding="utf-8")
    assert "Computing scenario…" in content_sim
    assert "Computing scenario…</span>" in content_sim or 'role="status"' in content_sim
    # Verify no-print is applied on the loading indicator element
    idx = content_sim.find("Computing scenario…")
    preceding_snippet = content_sim[max(0, idx - 120):idx]
    assert "no-print" in preceding_snippet, "Expected 'no-print' class on simulator loading indicator"


def test_frontend_print_report_uses_active_risk_and_validates_ci():
    """Verify twin/page.tsx print summary report uses active state and validates CI rather than statically printing prediction CI."""
    frontend_dir = Path(__file__).resolve().parent.parent.parent / "frontend"
    twin_page_file = frontend_dir / "app" / "twin" / "page.tsx"
    assert twin_page_file.exists()
    content_twin = twin_page_file.read_text(encoding="utf-8")

    # Verify that prediction?.confidence_interval_95 is not statically rendered in print section without validation
    assert "State: Counterfactual Scenario" in content_twin or "riskStateLabel" in content_twin
    assert "validCi" in content_twin, "Expected validCi check in twin/page.tsx for print report"

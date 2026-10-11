"""
Pytest test suite for TwinCare / Pramana Clinical Twin API.
Tests:
  - Health check & schema fingerprint
  - Model info metadata & calibration
  - Forbidden column rejection (Phase 15 guardrail)
  - Missing feature detection
  - What-If correlated column shifting consistency
  - Probability range [0, 1] & Platt calibration
  - Timeline risk replay structure
  - Deterministic wearable simulation with 'simulated: True'
  - Local JSONL inference audit logging
"""

import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.main import app, _model_svc, _patient_svc


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


# 1. Health check & schema fingerprint
def test_health_check(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["model_version"] == "1.0.0"
    assert len(data["schema_fingerprint"]) == 16
    assert data["feature_count"] == 132
    assert data["model_loaded"] is True


# 2. Model info & calibration
def test_model_info(client):
    res = client.get("/api/v1/model/info")
    assert res.status_code == 200
    data = res.json()
    assert "metrics" in data
    assert data["metrics"]["roc_auc"] > 0.70
    assert len(data["metrics"]["roc_auc_ci_95"]) == 2
    assert data["metrics"]["base_rate"] < 0.05  # Imbalanced ~1.46%
    assert data["calibration"]["method"].startswith("Platt")
    assert "limitations" in data
    assert len(data["limitations"]) >= 5


# 3. Patients directory
def test_list_patients(client):
    res = client.get("/api/v1/patients?limit=10")
    assert res.status_code == 200
    pts = res.json()
    assert len(pts) == 10
    first = pts[0]
    assert "id" in first
    assert "display_id" in first
    assert "risk_tier" in first
    assert first["risk_tier"] in ["Low", "Moderate", "High"]
    assert 0.0 <= first["calibrated_risk"] <= 1.0


# 4. Patient detail (Twin state)
def test_patient_detail(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]
    res = client.get(f"/api/v1/patients/{pid}")
    assert res.status_code == 200
    detail = res.json()
    assert detail["id"] == pid
    assert "latest_vitals" in detail
    assert "conditions" in detail
    assert "medications" in detail
    assert "snapshots" in detail
    assert len(detail["snapshots"]) >= 1


# 5. Predict with patient_id & calibration range
def test_predict_patient_id(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]
    res = client.post("/api/v1/predict", json={"patient_id": pid})
    assert res.status_code == 200
    pred = res.json()
    assert 0.0 <= pred["raw_score"] <= 1.0
    assert 0.0 <= pred["calibrated_risk"] <= 1.0
    assert pred["risk_tier"] in ["Low", "Moderate", "High"]
    assert len(pred["top_contributing_factors"]) > 0
    # Factors have plain-English labels and directions
    factor = pred["top_contributing_factors"][0]
    assert "label" in factor
    assert factor["direction"] in ["increases_risk", "reduces_risk"]


def test_forbidden_column_rejection(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]
    p_detail = client.get(f"/api/v1/patients/{pid}").json()
    row = dict(p_detail["feature_row"])

    # Inject forbidden leakage columns
    row["target_label"] = 1.0
    res = client.post("/api/v1/predict", json={"features": row})
    assert res.status_code == 422
    assert "Forbidden column" in res.json()["detail"]

    del row["target_label"]
    row["event_date"] = "2026-03-15"
    res = client.post("/api/v1/predict", json={"features": row})
    assert res.status_code == 422
    assert "Forbidden column" in res.json()["detail"]


# 7. Missing features rejection
def test_missing_features_rejection(client):
    res = client.post("/api/v1/predict", json={"features": {"age_at_t": 55.0}})
    assert res.status_code == 422
    assert "Missing" in res.json()["detail"]


# 8. What-If correlated column shifting consistency
def test_whatif_correlated_columns(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]

    res = client.post("/api/v1/whatif", json={
        "patient_id": pid,
        "sbp_delta": -10.0,
        "weight_change_pct": -0.05,
    })
    assert res.status_code == 200
    wi = res.json()
    assert wi["sbp_delta_applied"] == -10.0
    assert wi["weight_change_pct_applied"] == -0.05
    assert wi["features_changed_count"] >= 10  # Multiple SBP, Weight, BMI, Pulse Pressure columns

    # Verify key correlated columns were shifted
    changed = wi["features_changed"]
    assert "sbp_latest" in changed
    assert "sbp_mean_365d" in changed
    assert "weight_latest" in changed
    assert "bmi_latest" in changed
    assert "pulse_pressure_latest" in changed

    # Probabilities in range
    assert 0.0 <= wi["baseline_risk"] <= 1.0
    assert 0.0 <= wi["scenario_risk"] <= 1.0
    assert "Model-based scenario" in wi["caveat"]


# 9. What-If clamping and out-of-distribution warning
def test_whatif_clamping(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]

    # Test clamping beyond +/-30
    res = client.post("/api/v1/whatif", json={
        "patient_id": pid,
        "sbp_delta": -50.0,  # Clamped to -30
        "weight_change_pct": 0.80,  # Clamped to 0.30
    })
    assert res.status_code == 200
    wi = res.json()
    assert wi["sbp_delta_applied"] == -30.0
    assert wi["weight_change_pct_applied"] == 0.30


# 10. Longitudinal timeline risk replay
def test_timeline_risk_replay(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]
    res = client.get(f"/api/v1/patients/{pid}/timeline-risk")
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == pid
    assert len(data["snapshots"]) >= 1
    snap = data["snapshots"][0]
    assert "snapshot_id" in snap
    assert "date" in snap
    assert "calibrated_risk" in snap


# 11. Global explainability
def test_global_explain(client):
    res = client.get("/api/v1/explain/global")
    assert res.status_code == 200
    data = res.json()
    assert "top_features" in data
    assert len(data["top_features"]) >= 10
    assert data["top_features"][0]["rank"] == 1


# 12. Simulated wearable feed
def test_simulated_wearable(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]
    res = client.post("/api/v1/simulate/wearable", json={"patient_id": pid, "days": 7})
    assert res.status_code == 200
    wearable = res.json()
    assert wearable["simulated"] is True
    assert wearable["tag"] == "SIMULATED"
    assert len(wearable["daily_readings"]) == 7
    for reading in wearable["daily_readings"]:
        assert reading["simulated"] is True
        assert "resting_heart_rate" in reading
        assert "home_bp_morning" in reading


# 13. Audit log persistence
def test_audit_log(client):
    res = client.get("/api/v1/audit?limit=5")
    assert res.status_code == 200
    data = res.json()
    assert "entries" in data
    assert len(data["entries"]) >= 1
    entry = data["entries"][0]
    assert "timestamp" in entry
    assert "schema_fingerprint" in entry
    assert "input_hash" in entry
    assert "score" in entry


# 14. Full Simulator: No-edit scenario returns exact baseline score & risk
def test_simulate_no_edit_exact_baseline(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]

    # Call with no levers changed
    res = client.post("/api/v1/simulate", json={"patient_id": pid})
    assert res.status_code == 200
    sim = res.json()

    assert sim["patient_id"] == pid
    assert sim["features_changed"] == []
    assert sim["delta_risk_pp"] == 0.0
    assert sim["delta_raw_pp"] == 0.0
    assert sim["scenario_raw"] == sim["baseline_raw"]
    assert sim["scenario_risk"] == sim["baseline_risk"]
    assert sim["scenario_tier"] == sim["baseline_tier"]
    assert sim["tier_changed"] is False
    assert sim["is_out_of_range"] is False


# 15. Full Simulator: Editing a variable changes only its mapped columns
def test_simulate_mapped_columns_only(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]

    # Shift SBP by -12 mmHg
    res = client.post("/api/v1/simulate", json={
        "patient_id": pid,
        "sbp_delta": -12.0,
    })
    assert res.status_code == 200
    sim = res.json()

    changed = sim["features_changed"]
    assert len(changed) > 0

    # Only SBP-mapped columns should change (sbp_latest, sbp_mean_365d, etc.)
    for col in changed:
        assert "sbp" in col or col in ["pulse_pressure_latest", "pulse_pressure_mean_365d", "baseline_sbp"], (
            f"Unmapped column changed: {col}"
        )

    # Completely unrelated variables must NOT be modified
    assert "glucose_latest" not in changed
    assert "heart_rate_latest" not in changed
    assert "weight_latest" not in changed
    assert "bmi_latest" not in changed


# 16. Full Simulator: Out-of-range input is flagged & presets are repeatable
def test_simulate_out_of_range_and_presets(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]

    # 1. Out-of-range input: extreme SBP shift beyond plausible bounds
    res_oor = client.post("/api/v1/simulate", json={
        "patient_id": pid,
        "sbp_value": 260.0,  # Far above training 99th percentile
    })
    assert res_oor.status_code == 200
    sim_oor = res_oor.json()
    assert sim_oor["is_out_of_range"] is True
    assert any("OUT_OF_RANGE" in w for w in sim_oor["warnings"])

    # 2. Preset repeatability: applying identical preset twice yields identical results
    preset_payload = {
        "patient_id": pid,
        "sbp_delta": -15.0,
        "weight_delta_pct": -0.05,
        "trend": "improving",
    }
    run1 = client.post("/api/v1/simulate", json=preset_payload).json()
    run2 = client.post("/api/v1/simulate", json=preset_payload).json()

    assert run1["scenario_raw"] == run2["scenario_raw"]
    assert run1["scenario_risk"] == run2["scenario_risk"]
    assert run1["delta_risk_pp"] == run2["delta_risk_pp"]
    assert run1["features_changed"] == run2["features_changed"]


# 17. Live Stream: Endpoint updates patient state, summary and risk
def test_stream_reading_updates_state_and_risk(client):
    pts = client.get("/api/v1/patients?limit=1").json()
    pid = pts[0]["id"]

    reading_payload = {
        "patient_id": pid,
        "sbp": 158.0,
        "dbp": 96.0,
        "hr": 84.0,
        "spo2": 97.0,
        "steps": 4500,
        "reading_type": "cuff",
    }
    res = client.post("/api/v1/stream/reading", json=reading_payload)
    assert res.status_code == 200
    data = res.json()

    assert data["reading_accepted"] is True
    assert data["simulated"] is True
    assert "wearable_summary" in data
    assert "alert_flags" in data
    assert "updated_risk" in data
    assert 0.0 <= data["updated_risk"]["calibrated_risk"] <= 1.0


# 18. ABDM / FHIR Ingestion: Valid Bundle maps features & invalid bundle is rejected
def test_fhir_bundle_import_mapping_and_validation(client):
    # 1. Valid FHIR Bundle with Patient & BP Observation
    valid_bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "synthetic-in-001",
                    "gender": "male",
                    "birthDate": "1968-05-12",
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "code": {
                        "coding": [
                            {"system": "http://loinc.org", "code": "85354-9", "display": "Blood Pressure"}
                        ]
                    },
                    "component": [
                        {
                            "code": {"coding": [{"code": "8480-6"}]},
                            "valueQuantity": {"value": 146.0, "unit": "mmHg"},
                        },
                        {
                            "code": {"coding": [{"code": "8462-4"}]},
                            "valueQuantity": {"value": 92.0, "unit": "mmHg"},
                        },
                    ],
                }
            },
        ],
    }

    res_valid = client.post("/api/v1/import/fhir", json={"bundle": valid_bundle})
    assert res_valid.status_code == 200
    report = res_valid.json()
    assert report["valid"] is True
    assert report["features_populated"] > 0
    assert report["observations_mapped"] >= 1
    assert report["simulated_prediction"] is not None
    assert 0.0 <= report["simulated_prediction"]["calibrated_risk"] <= 1.0

    # 2. Invalid FHIR Bundle (Missing resourceType or not a Bundle)
    invalid_bundle = {
        "resourceType": "Patient",  # Not a Bundle
        "id": "single-patient",
    }
    res_invalid = client.post("/api/v1/import/fhir", json={"bundle": invalid_bundle})
    assert res_invalid.status_code == 200
    report_invalid = res_invalid.json()
    assert report_invalid["valid"] is False
    assert len(report_invalid["validation_errors"]) > 0


# 19. Audit Log: Cryptographic hash-chain integrity verification
def test_audit_hash_chain_integrity(client):
    res = client.get("/api/v1/audit/verify")
    assert res.status_code == 200
    data = res.json()
    assert "is_valid" in data
    assert "total_entries" in data
    # Normal undisturbed log must be valid
    assert data["is_valid"] is True
    assert data["tampered_at_index"] is None


# 20. Audit Log: Tampering detection catches modified records
def test_audit_tampering_detection(tmp_path):
    from app.services.audit_service import AuditService, GENESIS_HASH

    # Create an isolated temporary audit service
    temp_log_file = tmp_path / "tampered_audit.jsonl"
    audit = AuditService(log_path=temp_log_file)

    # Log 3 consecutive entries
    e1 = audit.log({
        "timestamp": "2026-03-15T10:00:00",
        "model_version": "1.0.0",
        "schema_fingerprint": "a4ddaedbdbc8bb07",
        "input_hash": "11111111",
        "score": 0.25,
        "calibrated_risk": 0.12,
        "risk_tier": "Low",
        "context": "predict",
    })
    e2 = audit.log({
        "timestamp": "2026-03-15T10:01:00",
        "model_version": "1.0.0",
        "schema_fingerprint": "a4ddaedbdbc8bb07",
        "input_hash": "22222222",
        "score": 0.55,
        "calibrated_risk": 0.35,
        "risk_tier": "Moderate",
        "context": "predict",
    })
    e3 = audit.log({
        "timestamp": "2026-03-15T10:02:00",
        "model_version": "1.0.0",
        "schema_fingerprint": "a4ddaedbdbc8bb07",
        "input_hash": "33333333",
        "score": 0.85,
        "calibrated_risk": 0.62,
        "risk_tier": "High",
        "context": "predict",
    })

    # Verify initial integrity is 100% valid
    res_initial = audit.verify_integrity()
    assert res_initial["is_valid"] is True
    assert res_initial["total_entries"] == 3

    # Tamper with entry #1 (change the risk score without recomputing downstream hashes)
    with audit._lock:
        audit._log[1]["score"] = 0.99

    # Verify integrity now immediately catches tampering at index 1
    res_tampered = audit.verify_integrity()
    assert res_tampered["is_valid"] is False
    assert res_tampered["tampered_at_index"] == 1
    assert "Tampering detected" in res_tampered["message"] or "mismatch" in res_tampered["message"]


# 21. Patient Registration: Valid data returns risk in [0, 1] and persists across restarts
def test_register_patient_valid_and_persistence(client):
    payload = {
        "display_name": "Test Subject Alpha",
        "age": 58,
        "gender": "Female",
        "sbp": 142.0,
        "dbp": 88.0,
        "heart_rate": 74.0,
        "weight_kg": 72.0,
        "height_cm": 165.0,
        "glucose": 105.0,
        "hba1c": 5.9,
        "medications": {"antihypertensive": True},
        "conditions": {"essential_hypertension": True},
        "smoking": False,
        "family_history_hypertension": True,
    }
    res = client.post("/api/v1/patients/register", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    pid = data["patient_id"]
    assert pid.startswith("REG-")
    assert 0.0 <= data["calibrated_risk"] <= 1.0
    assert 0.0 <= data["raw_score"] <= 1.0
    assert data["risk_tier"] in ["Low", "Moderate", "High"]
    assert data["is_registered"] is True
    assert data["is_demo"] is False
    assert len(data["top_contributing_factors"]) > 0

    # Test retrieval via patient detail endpoint
    detail_res = client.get(f"/api/v1/patients/{pid}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == pid
    assert detail["age"] == 58
    assert detail["latest_vitals"]["sbp"] == 142.0

    # Test persistence by instantiating fresh PatientService from disk
    from app.services.patient_service import PatientService
    artifacts_dir = backend_dir / "artifacts" if (backend_dir / "artifacts").exists() else Path("artifacts")
    fresh_service = PatientService(artifacts_dir)
    persisted_pt = fresh_service.get_patient(pid)
    assert persisted_pt is not None
    assert persisted_pt["id"] == pid

    # Clean up test patient
    del_res = client.delete(f"/api/v1/patients/{pid}")
    assert del_res.status_code == 200


# 22. Patient Registration: Invalid & out-of-range values return field errors; forbidden columns rejected
def test_register_patient_validation_and_forbidden_columns(client):
    # Out of range SBP (> 260)
    bad_sbp = {
        "age": 50,
        "sbp": 320.0,
        "dbp": 80.0,
    }
    res_sbp = client.post("/api/v1/patients/register", json=bad_sbp)
    assert res_sbp.status_code == 422
    err_body = res_sbp.json()
    assert "field_errors" in err_body
    assert "sbp" in err_body["field_errors"]

    # DBP >= SBP
    bad_dbp = {
        "age": 50,
        "sbp": 120.0,
        "dbp": 130.0,
    }
    res_dbp = client.post("/api/v1/patients/register", json=bad_dbp)
    assert res_dbp.status_code == 422
    err_body2 = res_dbp.json()
    assert "dbp" in err_body2["field_errors"]

    # Forbidden column in custom_features
    forbid = {
        "age": 50,
        "sbp": 130.0,
        "dbp": 85.0,
        "custom_features": {"target_label": 1},
    }
    res_forbid = client.post("/api/v1/patients/register", json=forbid)
    assert res_forbid.status_code == 422
    err_body3 = res_forbid.json()
    assert "forbidden_columns" in err_body3["field_errors"]

    # Unknown column in custom_features
    unknown = {
        "age": 50,
        "sbp": 130.0,
        "dbp": 85.0,
        "custom_features": {"fictional_marker_xyz": 999},
    }
    res_unknown = client.post("/api/v1/patients/register", json=unknown)
    assert res_unknown.status_code == 422
    err_body4 = res_unknown.json()
    assert "unknown_columns" in err_body4["field_errors"]


# 23. Patient Registration: Sparse registration produces LOW_DATA warning and never invents features
def test_sparse_registration_low_data_warning(client):
    sparse_payload = {
        "age": 42,
        "gender": "Male",
        "sbp": 135.0,
        "dbp": 85.0,
    }
    res = client.post("/api/v1/patients/register", json=sparse_payload)
    assert res.status_code == 200
    data = res.json()
    pid = data["patient_id"]

    # Verify LOW_DATA warning present
    warnings = data.get("warnings", [])
    assert any("LOW_DATA" in w for w in warnings)
    assert data["data_completeness_pct"] < 75.0

    # Verify longitudinal trend features are NOT invented (remain None / NaN)
    twin = data["patient_twin"]
    f_row = twin["feature_row"]
    assert f_row["sbp_change_365d"] is None or (isinstance(f_row["sbp_change_365d"], float) and f_row["sbp_change_365d"] != f_row["sbp_change_365d"])

    # Clean up
    client.delete(f"/api/v1/patients/{pid}")


# 24. Adding a reading updates twin state and risk; deletion works; audit chain verifies
def test_add_reading_and_deletion_and_audit_chain(client):
    # 1. Register
    reg_payload = {
        "display_name": "Dynamic Reader",
        "age": 60,
        "sbp": 130.0,
        "dbp": 80.0,
        "heart_rate": 70.0,
    }
    reg_res = client.post("/api/v1/patients/register", json=reg_payload)
    assert reg_res.status_code == 200
    pid = reg_res.json()["patient_id"]
    initial_risk = reg_res.json()["calibrated_risk"]

    # 2. Add an acute hypertensive reading
    reading_payload = {
        "sbp": 178.0,
        "dbp": 105.0,
        "hr": 92.0,
    }
    add_res = client.post(f"/api/v1/patients/{pid}/readings", json=reading_payload)
    assert add_res.status_code == 200
    add_data = add_res.json()
    assert add_data["readings_count"] == 2
    assert add_data["latest_vitals"]["sbp"] == 178.0
    assert add_data["latest_vitals"]["dbp"] == 105.0
    assert len(add_data["snapshots"]) == 2

    # Check updated twin
    detail_res = client.get(f"/api/v1/patients/{pid}")
    detail = detail_res.json()
    assert detail["latest_vitals"]["sbp"] == 178.0
    assert len(detail["snapshots"]) == 2

    # 3. Check audit chain integrity includes register & reading events
    verify_res = client.get("/api/v1/audit/verify")
    assert verify_res.status_code == 200
    assert verify_res.json()["is_valid"] is True

    # 4. Attempt deleting a demo patient -> 403 Forbidden
    del_demo = client.delete("/api/v1/patients/PT-101")
    assert del_demo.status_code == 403

    # 5. Delete the registered patient
    del_reg = client.delete(f"/api/v1/patients/{pid}")
    assert del_reg.status_code == 200
    assert del_reg.json()["deleted"] is True

    # Verify patient is gone
    gone_res = client.get(f"/api/v1/patients/{pid}")
    assert gone_res.status_code == 404

    # Verify audit chain integrity still 100% valid after deletion event
    verify_final = client.get("/api/v1/audit/verify")
    assert verify_final.status_code == 200
    assert verify_final.json()["is_valid"] is True


# 25. FHIR Patient Import alternative path registers patient and produces mapping report
def test_fhir_bundle_registration(client):
    bundle = {
        "resourceType": "Bundle",
        "type": "collection",
        "entry": [
            {
                "resource": {
                    "resourceType": "Patient",
                    "id": "ABDM-FHIR-TEST",
                    "name": [{"text": "Suresh Patel"}],
                    "gender": "male",
                    "birthDate": "1968-04-12",
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "code": {
                        "coding": [{"code": "8480-6", "display": "Systolic blood pressure"}]
                    },
                    "valueQuantity": {"value": 152.0, "unit": "mmHg"},
                }
            },
            {
                "resource": {
                    "resourceType": "Observation",
                    "code": {
                        "coding": [{"code": "8462-4", "display": "Diastolic blood pressure"}]
                    },
                    "valueQuantity": {"value": 94.0, "unit": "mmHg"},
                }
            },
        ],
    }
    res = client.post("/api/v1/patients/import-fhir", json={"bundle": bundle})
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["observations_mapped"] >= 2
    assert data["registered_patient_id"] is not None
    reg_pid = data["registered_patient_id"]
    assert reg_pid.startswith("REG-")

    # Clean up imported patient
    client.delete(f"/api/v1/patients/{reg_pid}")


# 26. Feature Map: The main page renders all feature links and every link resolves
def test_main_page_feature_links_resolve():
    import re
    frontend_page = Path(__file__).resolve().parent.parent.parent / "frontend" / "app" / "page.tsx"
    assert frontend_page.exists(), f"Landing page not found at {frontend_page}"
    
    content = frontend_page.read_text(encoding="utf-8")
    
    # Extract all internal href links
    href_matches = re.findall(r'href=["\'](/[^"\'#\?]+)', content)
    unique_routes = sorted(set(href_matches))
    assert len(unique_routes) >= 8, f"Expected comprehensive feature map, found: {unique_routes}"
    
    frontend_app_dir = frontend_page.parent
    for route in unique_routes:
        clean_route = route.strip("/")
        if not clean_route:
            target_file = frontend_app_dir / "page.tsx"
        else:
            target_file = frontend_app_dir / clean_route / "page.tsx"
        assert target_file.exists(), f"Route '{route}' does not resolve to an existing page file: {target_file}"



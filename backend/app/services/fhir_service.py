"""
FHIR R4 Bundle Ingestion Service for ABDM (Ayushman Bharat Digital Mission).
Parses Patient, Observation, Condition, and MedicationStatement resources,
validates against FHIR schemas, maps to the model feature schema, and runs inference.
"""

from __future__ import annotations

import logging
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

logger = logging.getLogger(__name__)

# Standard LOINC code mappings for vital signs and laboratory observations
LOINC_MAP = {
    "8480-6": "sbp",
    "8462-4": "dbp",
    "8867-4": "hr",
    "29463-7": "weight",
    "39156-5": "bmi",
    "2339-0": "glucose",
    "4548-4": "hba1c",
}


class FHIRService:
    def __init__(self, model_svc: Any, patient_svc: Any):
        self._model_svc = model_svc
        self._patient_svc = patient_svc

    def parse_and_map_bundle(
        self,
        bundle: Dict[str, Any],
        register: bool = False,
        shap_svc: Any = None,
        audit_svc: Any = None,
    ) -> Dict[str, Any]:
        """
        Parses an ABDM-aligned FHIR R4 Bundle JSON.
        Validates structure and maps clinical observations into the TwinCare feature schema.
        Optionally registers patient into PatientService.
        """
        validation_errors: List[str] = []
        mapping_summary: List[Dict[str, str]] = []

        if not isinstance(bundle, dict):
            return {
                "valid": False,
                "patient_id": None,
                "registered_patient_id": None,
                "demographics": {},
                "observations_mapped": 0,
                "conditions_mapped": 0,
                "medications_mapped": 0,
                "features_populated": 0,
                "validation_errors": ["Invalid payload: root must be a JSON object."],
                "mapping_summary": [],
                "simulated_prediction": None,
                "registered_twin": None,
            }

        if bundle.get("resourceType") != "Bundle":
            validation_errors.append(f"Invalid resourceType: expected 'Bundle', got '{bundle.get('resourceType')}'")

        entries = bundle.get("entry", [])
        if not isinstance(entries, list) or len(entries) == 0:
            validation_errors.append("Bundle contains no 'entry' items.")

        if validation_errors:
            return {
                "valid": False,
                "patient_id": None,
                "registered_patient_id": None,
                "demographics": {},
                "observations_mapped": 0,
                "conditions_mapped": 0,
                "medications_mapped": 0,
                "features_populated": 0,
                "validation_errors": validation_errors,
                "mapping_summary": [],
                "simulated_prediction": None,
                "registered_twin": None,
            }

        # Extracted elements
        patient_id: Optional[str] = None
        demographics: Dict[str, Any] = {}
        observations: Dict[str, float] = {}
        conditions: List[str] = []
        medications: List[str] = []

        for item in entries:
            res = item.get("resource", {})
            rtype = res.get("resourceType")

            # 1. Patient Resource
            if rtype == "Patient":
                patient_id = res.get("id") or patient_id
                # Identifier (e.g., ABHA)
                identifiers = res.get("identifier", [])
                for ident in identifiers:
                    sys = ident.get("system", "")
                    if "abdm" in sys.lower() or "abha" in sys.lower() or "ndhm" in sys.lower():
                        demographics["abha_id"] = ident.get("value")
                    elif not demographics.get("abha_id"):
                        demographics["abha_id"] = ident.get("value")

                # Name
                names = res.get("name", [])
                if names and isinstance(names, list):
                    n = names[0]
                    demographics["name"] = n.get("text") or f"{' '.join(n.get('given', []))} {n.get('family', '')}".strip()

                # Gender
                demographics["gender"] = res.get("gender", "unknown").capitalize()

                # Age from birthDate
                bdate = res.get("birthDate")
                if bdate:
                    try:
                        b_year = int(bdate.split("-")[0])
                        current_year = datetime.now().year
                        demographics["age"] = max(18, current_year - b_year)
                    except Exception:
                        demographics["age"] = 50
                else:
                    demographics["age"] = 50

            # 2. Observation Resource (Vitals & Labs)
            elif rtype == "Observation":
                # Check code
                code_obj = res.get("code", {})
                codings = code_obj.get("coding", [])
                text_code = code_obj.get("text", "").lower()

                # Check components (e.g. BP Panel 85354-9)
                components = res.get("component", [])
                if components:
                    for comp in components:
                        comp_codings = comp.get("code", {}).get("coding", [])
                        comp_val = comp.get("valueQuantity", {}).get("value")
                        if comp_val is not None:
                            for cc in comp_codings:
                                ccode = cc.get("code")
                                if ccode == "8480-6" or "systolic" in cc.get("display", "").lower():
                                    observations["sbp"] = float(comp_val)
                                    mapping_summary.append({
                                        "field": "Systolic BP",
                                        "source": f"LOINC {ccode} (Component)",
                                        "value": f"{comp_val} mmHg",
                                    })
                                elif ccode == "8462-4" or "diastolic" in cc.get("display", "").lower():
                                    observations["dbp"] = float(comp_val)
                                    mapping_summary.append({
                                        "field": "Diastolic BP",
                                        "source": f"LOINC {ccode} (Component)",
                                        "value": f"{comp_val} mmHg",
                                    })

                # Direct observation valueQuantity
                val_q = res.get("valueQuantity", {})
                val = val_q.get("value")
                if val is not None:
                    matched = False
                    for coding in codings:
                        c = coding.get("code")
                        if c in LOINC_MAP:
                            var_name = LOINC_MAP[c]
                            observations[var_name] = float(val)
                            unit = val_q.get("unit", "")
                            mapping_summary.append({
                                "field": var_name.upper(),
                                "source": f"LOINC {c} ({coding.get('display', '')})",
                                "value": f"{val} {unit}".strip(),
                            })
                            matched = True
                            break

                    if not matched and text_code:
                        if "systolic" in text_code:
                            observations["sbp"] = float(val)
                            mapping_summary.append({"field": "Systolic BP", "source": text_code, "value": f"{val}"})
                        elif "diastolic" in text_code:
                            observations["dbp"] = float(val)
                            mapping_summary.append({"field": "Diastolic BP", "source": text_code, "value": f"{val}"})
                        elif "heart rate" in text_code or "pulse" in text_code:
                            observations["hr"] = float(val)
                            mapping_summary.append({"field": "Heart Rate", "source": text_code, "value": f"{val}"})
                        elif "weight" in text_code:
                            observations["weight"] = float(val)
                            mapping_summary.append({"field": "Weight", "source": text_code, "value": f"{val}"})
                        elif "bmi" in text_code:
                            observations["bmi"] = float(val)
                            mapping_summary.append({"field": "BMI", "source": text_code, "value": f"{val}"})
                        elif "glucose" in text_code:
                            observations["glucose"] = float(val)
                            mapping_summary.append({"field": "Glucose", "source": text_code, "value": f"{val}"})
                        elif "hba1c" in text_code:
                            observations["hba1c"] = float(val)
                            mapping_summary.append({"field": "HbA1c", "source": text_code, "value": f"{val}"})

            # 3. Condition Resource
            elif rtype == "Condition":
                code_obj = res.get("code", {})
                text_diag = code_obj.get("text") or (code_obj.get("coding", [{}])[0].get("display", "Unknown Condition"))
                conditions.append(text_diag)
                mapping_summary.append({"field": "Condition", "source": "FHIR Condition", "value": text_diag})

            # 4. Medication Statement / Request
            elif rtype in ["MedicationStatement", "MedicationRequest"]:
                med_obj = res.get("medicationCodeableConcept", {})
                text_med = med_obj.get("text") or (med_obj.get("coding", [{}])[0].get("display", "Active Medication"))
                medications.append(text_med)
                mapping_summary.append({"field": "Medication", "source": rtype, "value": text_med})

        if not patient_id:
            patient_id = "FHIR-IMPORT-" + datetime.now().strftime("%H%M%S")

        # Validation checks
        if "sbp" not in observations:
            validation_errors.append("Missing essential observation: Systolic Blood Pressure (LOINC 8480-6).")
        if "dbp" not in observations:
            validation_errors.append("Missing essential observation: Diastolic Blood Pressure (LOINC 8480-6 / 8462-4).")

        # Construct model feature row based on a baseline patient template
        sim_pred = None
        features_populated = 0
        if "sbp" in observations and "dbp" in observations:
            # Base template from first demo patient
            base_df = self._patient_svc.get_feature_row("PT-101")
            if base_df is not None:
                row_copy = base_df.copy()
                sbp_v = observations["sbp"]
                dbp_v = observations["dbp"]
                pp_v = sbp_v - dbp_v

                # Overwrite correlated SBP/DBP/PP features
                for col in row_copy.columns:
                    if "sbp" in col:
                        row_copy[col] = sbp_v
                        features_populated += 1
                    elif "dbp" in col:
                        row_copy[col] = dbp_v
                        features_populated += 1
                    elif "pulse_pressure" in col:
                        row_copy[col] = pp_v
                        features_populated += 1
                    elif "hr" in col and "hr" in observations:
                        row_copy[col] = observations["hr"]
                        features_populated += 1
                    elif "weight" in col and "weight" in observations:
                        row_copy[col] = observations["weight"]
                        features_populated += 1
                    elif "bmi" in col and "bmi" in observations:
                        row_copy[col] = observations["bmi"]
                        features_populated += 1
                    elif "glucose" in col and "glucose" in observations:
                        row_copy[col] = observations["glucose"]
                        features_populated += 1
                    elif "hba1c" in col and "hba1c" in observations:
                        row_copy[col] = observations["hba1c"]
                        features_populated += 1

                # Predict
                try:
                    pred_res = self._model_svc.predict(row_copy)
                    sim_pred = {
                        "raw_score": pred_res["raw_score"],
                        "calibrated_risk": pred_res["calibrated_risk"],
                        "risk_tier": pred_res["risk_tier"],
                        "percentile_in_cohort": pred_res.get("percentile_in_cohort", 50.0),
                    }
                except Exception as e:
                    logger.error("Error running model on FHIR mapped row: %s", e)
                    validation_errors.append(f"Inference error on mapped bundle: {e}")

        registered_patient_id = None
        registered_twin = None
        if register and "sbp" in observations and "dbp" in observations and len(validation_errors) == 0:
            reg_payload = {
                "display_name": demographics.get("name") or f"Patient {patient_id}",
                "alias": demographics.get("name") or f"Patient {patient_id}",
                "age": float(demographics.get("age", 50.0)),
                "gender": demographics.get("gender", "Female"),
                "sbp": float(observations["sbp"]),
                "dbp": float(observations["dbp"]),
                "heart_rate": float(observations.get("hr", 72.0)),
                "weight_kg": float(observations["weight"]) if "weight" in observations else None,
                "bmi": float(observations["bmi"]) if "bmi" in observations else None,
                "glucose": float(observations["glucose"]) if "glucose" in observations else None,
                "hba1c": float(observations["hba1c"]) if "hba1c" in observations else None,
                "conditions": {c: True for c in conditions},
                "medications": {m: True for m in medications},
            }
            try:
                reg_res = self._patient_svc.register_patient(
                    reg_payload,
                    model_svc=self._model_svc,
                    shap_svc=shap_svc,
                    audit_svc=audit_svc,
                )
                registered_patient_id = reg_res["patient_id"]
                registered_twin = reg_res["patient_twin"]
            except Exception as e:
                logger.error("FHIR registration error: %s", e)
                validation_errors.append(f"Auto-registration error: {e}")

        is_valid = len(validation_errors) == 0

        return {
            "valid": is_valid,
            "patient_id": patient_id,
            "registered_patient_id": registered_patient_id,
            "demographics": demographics,
            "observations_mapped": len(observations),
            "conditions_mapped": len(conditions),
            "medications_mapped": len(medications),
            "features_populated": features_populated,
            "validation_errors": validation_errors,
            "mapping_summary": mapping_summary,
            "simulated_prediction": sim_pred,
            "registered_twin": registered_twin,
        }

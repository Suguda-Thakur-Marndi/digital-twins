import sys
from pathlib import Path
import json
import pandas as pd
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from app.services.model_service import ModelService
from app.services.patient_service import PatientService
from app.services.shap_service import SHAPService

artifacts_dir = Path(__file__).resolve().parent / "artifacts"
if not artifacts_dir.exists():
    artifacts_dir = Path(__file__).resolve().parent.parent / "backend" / "artifacts"

ps = PatientService(artifacts_dir)
ms = ModelService(artifacts_dir)
ss = SHAPService(artifacts_dir, ms)

p = ps.get_patient("18622a98-20be-920f-051a-e0c584e71baa")
assert p is not None, "Patient '18622a98-20be-920f-051a-e0c584e71baa' not found"
print(f"Patient Name: {p['name']}, ID: {p['id']}")
fr = p["feature_row"]
df = pd.DataFrame([fr])

base_pred = ms.predict(df)
print(f"Baseline raw_score: {base_pred['raw_score']:.4f}")
print(f"Baseline calibrated_risk: {base_pred['calibrated_risk']:.4f} ({base_pred['calibrated_risk']*100:.1f}%)")
print(f"Baseline risk_tier: {base_pred['risk_tier']}")

print("\n--- Investigating the exact values from prompt ---")
# Prompt:
# Baseline calibrated risk: 15.3%
# Simulated calibrated risk: 3.2%
# Absolute shift: -12.12 percentage points
# Baseline raw score: 0.7562
# Simulated raw score: 0.0603
# Warning: OUT_OF_RANGE
# Simulated profile has worse glucose and HbA1c values than original

print(f"Baseline glucose_latest: {fr.get('glucose_latest')}, hba1c_latest: {fr.get('hba1c_latest')}")
print(f"Baseline sbp_latest: {fr.get('sbp_latest')}, dbp_latest: {fr.get('dbp_latest')}")

# Check what levers could yield raw score 0.0603 or calibrated risk 0.0319 (3.2%, delta -12.12 pp)
# Note that 15.31 - 12.12 = 3.19%!
# Let's search systematically:
target_calibrated = 0.0319
target_raw = 0.0603

print("\n--- Testing Individual Presets on Ananya ---")
base_sbp = fr.get('sbp_latest', 125.0)
base_dbp = fr.get('dbp_latest', 80.0)
base_wt = fr.get('weight_latest', 70.0)
base_gl = fr.get('glucose_latest', 100.0)
base_a1c = fr.get('hba1c_latest', 5.6)

presets = {
    'improve_bp': {'sbp_value': max(105, base_sbp - 15), 'dbp_value': max(70, base_dbp - 8), 'trend': 'improving'},
    'weight_loss': {'weight_value': max(45, round(base_wt * 0.93 * 10) / 10)},
    'salt_reduction': {'sbp_value': max(105, base_sbp - 6), 'dbp_value': max(70, base_dbp - 4)},
    'missed_med': {'sbp_value': base_sbp + 14, 'medications': {'antihypertensive_med_history': 0}, 'trend': 'worsening'},
    'worsening_diabetes': {'glucose_value': base_gl + 35, 'hba1c_value': min(12, round((base_a1c + 1.5)*10)/10), 'conditions': {'diabetes_history': 1}}
}

for name, l in presets.items():
    r = ms.simulate(df, l, shap_svc=ss)
    print(f"Preset '{name}':")
    print(f"  Raw: {r['scenario_raw']:.4f}, Risk: {r['scenario_risk']:.4f} ({r['scenario_risk']*100:.1f}%), Delta: {r['delta_risk_pp']:.2f} pp, OOR: {r['is_out_of_range']}")
    if r['warnings']:
        print(f"  Warnings ({len(r['warnings'])}): {r['warnings'][:2]}")

print("\n--- What happens if user applies 'improve_bp' AND THEN 'worsening_diabetes'? Or edits sliders? ---")
combined = {
    'sbp_value': max(105, base_sbp - 15),
    'dbp_value': max(70, base_dbp - 8),
    'trend': 'improving',
    'glucose_value': base_gl + 35,
    'hba1c_value': min(12, round((base_a1c + 1.5)*10)/10),
    'conditions': {'diabetes_history': 1}
}
r_comb = ms.simulate(df, combined, shap_svc=ss)
print("\n--- SHAP Attribution Analysis for Baseline vs Worsening Diabetes ---")
base_exp = ss.explain(df, n_drivers=10)
print("Baseline SHAP drivers:")
for d in base_exp:
    print(f"  {d['feature']} ({d.get('label')}): impact={d['impact']:.4f}, val={d.get('value')}")

# Find the exact combination that produced raw=0.0603 and delta=-12.12 pp:
# Let's search around glucose, hba1c, sbp, etc.
exact_match = None
for sbp_d in [0, -1, -2, -3, -4, -5, -6, -7, -8, -10, -12, -15]:
    for g_d in [30, 35, 40, 50, 60, 70]:
        for a_d in [1.0, 1.2, 1.5, 1.8, 2.0]:
            levers = {
                'glucose_value': base_gl + g_d,
                'hba1c_value': base_a1c + a_d,
                'conditions': {'diabetes_history': 1}
            }
            if sbp_d != 0:
                levers['sbp_delta'] = sbp_d
            r = ms.simulate(df, levers)
            if round(r['scenario_raw'], 4) == 0.0603 or (round(r['delta_risk_pp'], 2) == -12.12):
                exact_match = (levers, r)
                break
        if exact_match: break
    if exact_match: break

if exact_match:
    print(f"\nFOUND EXACT MATCH FOR USER SCENARIO!")
    print(f"Levers: {exact_match[0]}")
    r = exact_match[1]
    print(f"Baseline: raw={r['baseline_raw']:.4f}, risk={r['baseline_risk']*100:.1f}%")
    print(f"Simulated: raw={r['scenario_raw']:.4f}, risk={r['scenario_risk']*100:.1f}%, delta={r['delta_risk_pp']:.2f} pp")
    print(f"Warnings ({len(r['warnings'])}):")
    for w in r['warnings']:
        print(f"  - {w}")
else:
    print("Exact 0.0603 match not in simple grid, let's test worsening alone with SHAP:")
    worsening = {'glucose_value': base_gl + 35, 'hba1c_value': base_a1c + 1.5, 'conditions': {'diabetes_history': 1}}
    r = ms.simulate(df, worsening, shap_svc=ss)
    print(f"Worsening preset raw={r['scenario_raw']:.4f}, risk={r['scenario_risk']*100:.1f}%, delta={r['delta_risk_pp']:.2f} pp")
    print("Worsening SHAP drivers:")
    for d in r['shap_after']:
        print(f"  {d['feature']} ({d.get('label')}): impact={d['impact']:.4f}, val={d.get('value')}")
print("\n--- Tree Split Analysis for Glucose and HbA1c ---")
import joblib
pipe = ms._pipeline
booster = pipe.named_steps['model'].get_booster()
prep = pipe.named_steps['preprocess']
cols = list(prep.get_feature_names_out())
fmap = {f'f{i}': col for i, col in enumerate(cols)}

df_trees = booster.trees_to_dataframe()
df_trees['Feature_Name'] = df_trees['Feature'].map(fmap)
gl_splits = df_trees[df_trees['Feature_Name'].str.contains('glucose|hba1c', case=False, na=False)]
print(f"Total tree nodes splitting on glucose or hba1c: {len(gl_splits)}")
for _, r in gl_splits.head(25).iterrows():
    print(f"  Tree {r['Tree']}, Node {r['Node']}: {r['Feature_Name']} < {r['Split']:.2f}, Gain={r['Gain']:.2f}")

# Also check conditions: diabetes_history
cond_splits = df_trees[df_trees['Feature_Name'].str.contains('diabetes', case=False, na=False)]
print(f"\nTotal tree nodes splitting on diabetes: {len(cond_splits)}")
for _, r in cond_splits.iterrows():
    print(f"  Tree {r['Tree']}, Node {r['Node']}: {r['Feature_Name']} < {r['Split']:.2f}, Gain={r['Gain']:.2f}")




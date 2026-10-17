# 3-Minute Hackathon Demo Script: VitalTwin — AI-Powered Clinical Digital Twin

**Event:** Happiest Health "Reimagining and Reforming Healthcare in India Summit 2026", Bengaluru  
**Theme:** Digital Twin in Healthcare — Longitudinal Hypertension Decompensation Risk  
**Audience:** Clinical Jury, Health System Leaders, AI Researchers, and Health Ministry Observers  
**Presenter:** Lead Product Designer & Full-Stack Systems Engineer  
**Duration:** Exactly 3 Minutes (180 Seconds)

---

## Pitch Progression at a Glance

| Section | Time | Screen & Route | Core Action & Key Message |
| :--- | :--- | :--- | :--- |
| **1. Patient Opening & Twin State** | 0:00 – 0:30 (30s) | `/twin?patient=PT-101` | Open patient PT-101 (SYNTHETIC). Show 3D physiological core, latest vitals, calibrated risk (48.2% with 95% CI), signed SHAP drivers. |
| **2. Risk Replay & Early Warning** | 0:30 – 1:00 (30s) | `/twin` (Risk Replay Scrubber) | Scrub historical snapshots. Point out **Surveillance Alert marker (⚠️)** and the **Lead Time days callout** before the decompensation event. |
| **3. Live Ingestion & Streaming** | 1:00 – 1:30 (30s) | `/twin` (Wearables & Streaming) | Connect simulated Bluetooth BP cuff (`162/98 mmHg`). Hit **"Send Reading"** or toggle **"Auto-Simulate"**; watch risk, timeline, and telemetry update in real time. |
| **4. Full Patient Simulator** | 1:30 – 2:10 (40s) | `/twin` (Simulator Tab) | Shift SBP (-15 mmHg) & Weight (-5%); show all 10+ correlated columns shift via `lever_map.json`. Inspect sensitivity curves (tree step-plateaus) & apply presets. |
| **5. Patient View (Hindi / Kannada)** | 2:10 – 2:35 (25s) | `/twin` (Patient View Switcher) | Switch to **Patient View**; toggle to **Hindi (हिंदी)** or **Kannada (ಕನ್ನಡ)**. Large type, zero SHAP jargon, 3 recommended doctor questions. |
| **6. Model Card Honesty & Limitations** | 2:35 – 3:00 (25s) | `/performance` & `/model-card` | Walk through honest metrics: 0.7562 threshold flagged 0/14 test positives; PR-AUC 0.064 vs 1.46% base rate; synthetic Synthea data unvalidated in India. |

---

## Detailed Word-for-Word Presenter Script

### Step 1: Open a Patient & Establish the Digital Twin (0:00 – 0:30 | 30s)
**Action:** Open the app at `http://localhost:3000/twin?patient=PT-101`.
**Spoken Script:**
> *"Respected judges: Hypertension affects over 220 million citizens in India, yet fewer than 15% maintain controlled blood pressure. Conventional EHRs are retrospective filing cabinets—they record cardiovascular damage after it occurs.*
> 
> *This is **VitalTwin**—an AI-powered clinical digital twin that models longitudinal 365-day decompensation risk (*A Living Digital Perspective on Health*). On the screen is patient PT-101, Elena Rostova. Notice the prominent **SYNTHETIC** badge: this is built on Synthea EHR data.*
> 
> *Her digital twin synthesizes her entire 365-day trajectory: systolic BP 142, DBP 88, BMI 29.4. Her 1-year decompensation risk is calibrated via Platt scaling at **48.2%** [95% CI: 41.2%–55.4%]. We never display raw machine scores as probabilities. Her signed SHAP drivers explain why: her 1-year mean systolic BP (+0.14) and 90-day acceleration (+0.09) are driving risk upward."*

---

### Step 2: Longitudinal Risk Replay & Early Warning Marker (0:30 – 1:00 | 30s)
**Action:** Scroll down to the **Risk Replay Scrubber**. Click **Play** or scrub forward across historical snapshots.
**Spoken Script:**
> *"A digital twin is not a static calculator; it evolves as patient data arrives. Watch what happens as we scrub through Elena's history.*
> 
> *In Month 1, her risk was 14.1%—Low Tier. By Month 8, an uptick in systolic variance pushed her to Moderate Tier. Look at Snapshot 4: the digital twin flags an **Early Warning Alert (⚠️)** where risk crossed our surveillance threshold, giving clinicians a **112-day lead time** before her acute decompensation event.*
> 
> *Clinicians no longer wait for a stroke or hypertensive crisis; the early warning engine flags trajectory drift months in advance."*

---

### Step 3: Send a Live Reading & Telemetry Stream (1:00 – 1:30 | 30s)
**Action:** Scroll to the **Simulated Wearables & Telemetry Layer**. Show the manual entry form. Enter SBP `162`, DBP `98`, HR `88`. Click **"Send Reading"** (or flip **"Auto-Simulate Readings"** toggle).
**Spoken Script:**
> *"Now, let's inject live telemetry from an affordable Bluetooth BP monitor used in an Ayushman Arogya Mandir. Notice the clear **SIMULATED** label: our ML model does not ingest unvalidated wearable features directly, avoiding data contamination.*
> 
> *When I hit 'Send Reading', the twin's live stream endpoint (`POST /api/v1/stream/reading`) processes the reading in real time. Notice: her 7-day rolling vitals update, an alert rule triggers for home BP $\ge 140$ mmHg, and her calibrated risk recalculates instantly. The digital twin stays synchronized with the patient's daily life."*

---

### Step 4: Full Patient Simulator with Correlated Levers (1:30 – 2:10 | 40s)
**Action:** Click the **"Patient Simulator"** tab. Adjust **Systolic BP Delta** to `-15 mmHg` and **Weight Delta** to `-5%`. Point to the shifted features list, SHAP diff, and multi-point sensitivity curves. Click **"Save Scenario"** to demonstrate side-by-side comparison.
**Spoken Script:**
> *"Next is the **Full Patient Simulator**, replacing simplistic toy sliders. In clinical reality, you cannot lower systolic BP without altering rolling means, min, max, baseline, and pulse pressure.*
> 
> *Through our backend `lever_map.json`, moving the SBP lever automatically shifts all 10+ correlated columns consistently. Weight loss simultaneously recalculates BMI. If we enter an extreme value like 250 mmHg, the system clamps the feature and returns an explicit `OUT_OF_RANGE` warning.*
> 
> *Look at the sensitivity curve on the right: it marks Elena's current position along the model's non-linear step-function, explaining why certain tree-model thresholds require specific dosage shifts. We can apply one of 5 clinical presets—like 'Improve BP Control' or 'Salt Reduction'—save up to 3 scenarios, and export a side-by-side comparison report."*

---

### Step 5: Plain-Language Patient View in Hindi & Kannada (2:10 – 2:35 | 25s)
**Action:** Scroll up and switch the view toggle from **Clinician View** to **Patient View**. Click the Language Switcher and select **हिंदी (Hindi)** or **ಕನ್ನಡ (Kannada)**.
**Spoken Script:**
> *"Digital twins must empower patients, not alienate them. With one click, we switch to **Patient View**.*
> 
> *Notice: all SHAP jargon, machine learning formulas, and dense statistics disappear. In large, accessible typography, the patient sees: 'Your blood pressure readings have been gradually rising over the last 3 months.'*
> 
> *We support **English, Hindi, and Kannada** with human-quality translations. The view provides 3 concrete questions to ask the doctor during their next PHC visit—such as 'Should we review my salt intake or daily walking routine?'—with a strict safety notice: no unverified diagnoses and no automated prescription changes."*

---

### Step 6: Model Card Honesty & India Summit Limitations (2:35 – 3:00 | 25s)
**Action:** Click **"Honest Metrics"** (`/performance`) or **"Model Card"** (`/model-card`). Point to the calibration reliability plot, alert-budget table, and Indian guideline citations.
**Spoken Script:**
> *"Finally, we conclude with radical honesty—the hallmark of trustworthy healthcare AI.*
> 
> *On our Performance page, we openly publish what most demos conceal: our test set contains only 14 positive decompensation events out of 964 patients—a realistic 1.46% base rate. The theoretical 0.7562 cutoff flagged zero of the 14 positives. Instead, our **alert-budget operating policy** allows health systems to flag the top 10% highest-risk patients to capture 42.9% of imminent events.*
> 
> *Most importantly: this model was trained on US Synthea synthetic EHR data. It is **not yet validated on Indian populations**, who exhibit distinct visceral adiposity phenotypes and dietary sodium patterns. Our roadmap aligns with ABDM (Ayushman Bharat Digital Mission) FHIR standards and CDSCO SaMD clearance.*
> 
> *VitalTwin demonstrates how clinical digital twins can transform Indian healthcare from episodic crisis management to proactive, longitudinal prevention. Thank you."*

---

## Judge Q&A Rapid-Response Card

**Q1: How do you prevent temporal data leakage in longitudinal twins?**  
> *"Every snapshot at time $t$ freezes observation history strictly to the rolling 365-day lookback window $[t - 365d, t]$. The prediction target is strictly defined over the subsequent window $(t, t + 365d]$. Our test harness enforces a strict guardrail rejecting any post-event or target leakage columns with HTTP 422."*

**Q2: Why is the model PR-AUC 0.064?**  
> *"With an extreme base rate of 1.457% (14 positives in 964 test patients), random guess PR-AUC is 0.0146. A PR-AUC of 0.064 represents a **4.4-fold statistical enrichment** over baseline. We document this plainly on our Performance page alongside empirical 95% confidence intervals."*

**Q3: How is this integrated into India's public health infrastructure?**  
> *"Our `/import` pipeline accepts ABDM-aligned FHIR R4 JSON bundles (Patient, Observation, Condition, MedicationStatement) and ingests low-cost Bluetooth oscillometric cuff CSV data. The architecture runs sub-15ms on single-core CPUs, enabling deployment across rural Primary Health Centres and Ayushman Arogya Mandirs."*

---

# DESIGN.md — Pramana Twin Design & Clinical Architecture System
**Project: TwinCare / Pramana Twin**  
**Hackathon:** Happiest Health "Reimagining and Reforming Healthcare in India Summit 2026", Bengaluru  
**Domain:** Longitudinal Clinical Digital Twin for Hypertension Risk Decompensation  

---

## 1. Design Philosophy

Pramana Twin integrates high-density scientific data visualization with an elegant glassmorphism healthcare interface:
- **Information Density with Breathing Room**: Critical clinical parameters are dense, high-contrast, and scan-friendly; surrounding whitespace is deliberate and generous.
- **Glassmorphism & Frosted Panels**: Translucent panels with background blur (`backdrop-filter: blur(20px)`), subtle borders, and layered elevation over a composite healthcare backdrop.
- **Asymmetry over Uniformity**: Structured 12-column grid layout with intentional focal points rather than repeated rows of identical cards.
- **Truth in Numbers**: Strict tabular numerals (`font-mono tabular-nums`) for all physiological vitals, dates, percentages, and metrics.
- **Unambiguous Modesty**: Plain-English medical descriptors, explicit confidence intervals, and prominent disclosures of synthetic research data.

---

## 2. Color System & Design Tokens

The platform implements a centralized, dual-mode healthcare design token system:

### Light Theme (Default Healthcare Intelligence Canvas)
```css
:root {
  --bg-canvas: #EEF5FC;          /* Clean airy healthcare blue canvas */
  --bg-canvas-subtle: #E2EDF8;   /* Recessed surface */
  --glass-surface: rgba(255, 255, 255, 0.62);
  --glass-surface-strong: rgba(255, 255, 255, 0.82);
  --glass-border: rgba(255, 255, 255, 0.72);
  --glass-border-strong: rgba(37, 99, 235, 0.35);

  --color-primary: #2563EB;      /* Vibrant royal blue */
  --color-secondary: #0891B2;    /* Deep cyan */

  --text-primary: #172033;       /* Near-black deep navy ink */
  --text-secondary: #64748B;     /* Cool slate body text */
  --text-muted: #94A3B8;         /* Labels, units, timestamps */

  --risk-low: #0F766E;           /* Low risk (< 15%) */
  --risk-mod: #B45309;           /* Moderate risk (15–40%) */
  --risk-high: #B91C1C;          /* High risk (≥ 40%) */
}
```

### Dark Theme (Midnight Low-Light Environment)
```css
.dark {
  --bg-canvas: #07111F;          /* Deep midnight navy */
  --bg-canvas-subtle: #0B1728;   /* Recessed navy panel */
  --glass-surface: rgba(15, 29, 48, 0.62);
  --glass-surface-strong: rgba(20, 37, 59, 0.82);
  --glass-border: rgba(148, 183, 220, 0.16);
  --glass-border-strong: rgba(96, 165, 250, 0.38);

  --color-primary: #60A5FA;      /* Luminous celestial blue */
  --color-secondary: #22D3EE;    /* Electric cyan */

  --text-primary: #E7F0FC;       /* Crisp ice white */
  --text-secondary: #9BAFC7;     /* Muted silver blue */
  --text-muted: #64748B;

  --risk-low: #34D399;           /* Low risk */
  --risk-mod: #FBBF24;           /* Moderate risk */
  --risk-high: #FB7185;          /* High risk */
}
```

---

## 3. Typography Scale

- **Headline Serif**: Newsreader / Source Serif 4 (`font-serif`). Used for page titles, section introductions, and editorial takeaways.
- **Interface Sans**: Inter / IBM Plex Sans (`font-sans`). Used for form labels, navigation, buttons, and clinical text.
- **Tabular Monospace**: JetBrains Mono (`font-mono tabular-nums`). Applied universally to blood pressure readings, heart rates, dates, SHAP values, and confidence intervals.

| Role | Font Family | Size | Weight | Line Height | Tracking |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | Serif | 32px (2rem) | 600 (Semibold) | 1.2 | -0.02em |
| **Title 1** | Serif | 24px (1.5rem) | 600 (Semibold) | 1.25 | -0.015em |
| **Title 2** | Sans | 18px (1.125rem) | 600 (Semibold) | 1.35 | -0.01em |
| **Headline**| Sans | 14px (0.875rem) | 600 (Semibold) | 1.4 | 0 |
| **Body** | Sans | 13px (0.8125rem)| 400 (Regular) | 1.5 | 0 |
| **Clinical Value** | Mono Tabular | 20px–28px | 600 (Semibold) | 1.1 | -0.02em |
| **Audit Mono** | Mono | 10px–11px | 400 (Regular) | 1.3 | 0 |

---

## 4. 3D Spatial Core & Abstract Data Visualization

In strict adherence to design requirements, **zero** 3D human bodies, anatomical meshes, mannequins, GLB avatars, or cartoon humans are used:
- **Core Sphere**: Pulsing icosahedron core whose color, emissive intensity, and rotation speed reflect the patient's calibrated risk tier.
- **Orbital Vital Nodes**: Five interactive satellite spheres representing SBP, DBP, Heart Rate, BMI, and Pulse Pressure orbit the core.
- **Theme-Aware Canvas**: Dynamically shifts ambient and point lighting, polar grids, and background clearing colors between light and dark modes.

---

## 5. Clinical Impact & Public Health Architecture in India

### Target Users & Personas

| User Role | Clinical Setting | Interaction with Digital Twin | Key Value Delivered |
| :--- | :--- | :--- | :--- |
| **Primary Care Medical Officer (MBBS)** | PHCs, Community Health Centres (CHCs) | Reviews clinician dashboard, checks 365-day calibrated decompensation risk, inspects signed SHAP drivers, runs What-If simulations. | Replaces 2-minute rushed consultation guesswork with prioritized risk stratification and transparent clinical drivers. |
| **Community Health Worker (ASHA / ANM)** | Village health posts, doorstep visits, Ayushman Arogya Mandirs (AAMs) | Ingests home BP cuff and pulse oximeter readings; monitors simple red/amber/green status. | Actionable triage flags: enables early referral before patient experiences clinical crises. |
| **Consultant Cardiologist** | District Civil Hospitals, Tertiary Medical Colleges | Evaluates complex multi-morbid patients (diabetes + CKD + hypertension); reviews multi-point sensitivity curves. | Anticipatory drug titration with visible simulated trajectory shifts. |
| **Patient & Caregiver** | Home care, outpatient follow-up | Interacts with **Patient View** in regional languages (English, Hindi, Kannada); reviews plain-language trend summaries. | Eliminates medical jargon; boosts adherence and health literacy. |

### Care Continuum Across Indian Public Health

```
   [ Village / Sub-Centre Level ]
   Doorstep Screening: ASHA / ANM Workers (Bluetooth BP Cuff + Pulse Ox)
                 │
                 ▼
   [ Ayushman Arogya Mandir (AAM / Sub-Health Centre) ]
   Community Health Officer (CHO) Triage (ABDM FHIR Sync + Offline PWA)
                 │ (Flagged High Risk or Early Warning)
                 ▼
   [ Primary Health Centre (PHC) ]
   Medical Officer Consultation & What-If Simulation
                 │ (Severe Decompensation or Comorbidities)
                 ▼
   [ District Hospital / Tertiary Medical College ]
   Cardiology Referral & Longitudinal Outcome Tracking
```

---

## 6. Accessibility & Honest Copy Standards

1. **WCAG AA Compliance**: High-contrast ratios (> 4.5:1 on text, > 3:1 on graphical boundaries).
2. **Reduced Motion**: Respects `prefers-reduced-motion` with instant transitions and paused orbital rotations.
3. **Honest Clinical Copy**:
   - Zero hype words: no "AI-powered", "revolutionary", "seamless", "next-gen".
   - Plain disclosures: All patients labeled **SYNTHETIC**; all wearable feeds labeled **SIMULATED**.
   - Output explicitly designated as an **empirical risk signal**, never a diagnostic mandate.

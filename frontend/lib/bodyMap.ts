/**
 * bodyMap.ts
 * Rig bone mapping and hotspot definitions for the 3D generic humanoid avatar.
 *
 * Mappings:
 *  - Heart / Chest (spine upper bone): Heart rate & cardiovascular risk with gentle pulse
 *  - Left Upper Arm: Blood pressure cuff-style ring (SBP / DBP)
 *  - Abdomen / Hips: Weight, BMI, Glucose, HbA1c
 *  - Head: Age, Sex, Medication flags
 */

import { RiskTier } from "./types";

export interface BodyRegionVital {
  key: string;
  label: string;
  unit: string;
  normalRange: string;
  description: string;
}

export interface BodyRegionConfig {
  id: "heart_chest" | "left_arm_bp" | "abdomen_metabolic" | "head_demographics";
  name: string;
  anatomicalLabel: string;
  boneName: string;
  boneAliases: string[];
  fallbackPosition: [number, number, number]; // [x, y, z] relative to centered model
  markerOffset: [number, number, number]; // offset for HTML hotspot
  vitals: BodyRegionVital[];
  sparklineKeys: string[];
}

export const BODY_REGIONS: BodyRegionConfig[] = [
  {
    id: "heart_chest",
    name: "Heart & Cardiovascular Core",
    anatomicalLabel: "Thoracic Cavity · Upper Spine",
    boneName: "Spine2",
    boneAliases: ["Spine2", "mixamorigSpine2", "mixamorig:Spine2", "Spine1"],
    fallbackPosition: [0, 1.37, 0.05],
    markerOffset: [0, 0.04, 0.16],
    vitals: [
      {
        key: "hr",
        label: "Heart Rate",
        unit: "bpm",
        normalRange: "60–100 bpm",
        description: "Resting pulse rate; drives avatar rhythmic cardiac pulse.",
      },
      {
        key: "riskScore",
        label: "365-Day Risk Estimate",
        unit: "%",
        normalRange: "< 15.0% (Low Risk)",
        description: "Platt-calibrated 365-day hypertension decompensation risk.",
      },
      {
        key: "riskTier",
        label: "Clinical Tier",
        unit: "",
        normalRange: "Low / Moderate",
        description: "Risk classification category with calibrated decision boundary.",
      },
    ],
    sparklineKeys: ["hr"],
  },
  {
    id: "left_arm_bp",
    name: "Left Upper Arm (BP Cuff)",
    anatomicalLabel: "Brachial Artery · Left Bicep",
    boneName: "LeftArm",
    boneAliases: ["LeftArm", "mixamorigLeftArm", "mixamorig:LeftArm"],
    fallbackPosition: [0.22, 1.34, -0.02],
    markerOffset: [0.18, -0.02, 0.12],
    vitals: [
      {
        key: "sbp",
        label: "Systolic BP",
        unit: "mmHg",
        normalRange: "< 120 mmHg",
        description: "Peak arterial pressure during cardiac contraction.",
      },
      {
        key: "dbp",
        label: "Diastolic BP",
        unit: "mmHg",
        normalRange: "< 80 mmHg",
        description: "Resting arterial pressure between heart beats.",
      },
      {
        key: "pulse_pressure",
        label: "Pulse Pressure",
        unit: "mmHg",
        normalRange: "30–50 mmHg",
        description: "Difference between systolic and diastolic BP.",
      },
    ],
    sparklineKeys: ["sbp", "dbp"],
  },
  {
    id: "abdomen_metabolic",
    name: "Metabolic & Abdomen",
    anatomicalLabel: "Abdominal Cavity · Pelvic Axis",
    boneName: "Spine",
    boneAliases: ["Spine", "mixamorigSpine", "mixamorig:Spine", "Hips"],
    fallbackPosition: [0, 1.13, 0.04],
    markerOffset: [0, 0.0, 0.15],
    vitals: [
      {
        key: "weight",
        label: "Body Weight",
        unit: "kg",
        normalRange: "Clinical target based on height",
        description: "Current baseline body mass index driver.",
      },
      {
        key: "bmi",
        label: "BMI",
        unit: "kg/m²",
        normalRange: "18.5–24.9 kg/m²",
        description: "Body Mass Index indicating nutritional & adiposity status.",
      },
      {
        key: "glucose",
        label: "Fasting Blood Glucose",
        unit: "mg/dL",
        normalRange: "70–99 mg/dL",
        description: "Plasma glucose concentration.",
      },
      {
        key: "hba1c",
        label: "Glycated Hemoglobin (HbA1c)",
        unit: "%",
        normalRange: "< 5.7%",
        description: "Estimated 3-month mean glycaemic control.",
      },
    ],
    sparklineKeys: ["weight", "bmi"],
  },
  {
    id: "head_demographics",
    name: "Cranial Profile & Regimen",
    anatomicalLabel: "Cephalic Center · Neurovascular",
    boneName: "Head",
    boneAliases: ["Head", "mixamorigHead", "mixamorig:Head"],
    fallbackPosition: [0, 1.65, 0.02],
    markerOffset: [0, 0.08, 0.14],
    vitals: [
      {
        key: "age",
        label: "Patient Age",
        unit: "years",
        normalRange: "Demographic risk modifier",
        description: "Chronological age at evaluation date.",
      },
      {
        key: "gender",
        label: "Biological Sex",
        unit: "",
        normalRange: "Demographic baseline",
        description: "Recorded baseline sex for reference ranges.",
      },
      {
        key: "medications",
        label: "Active Pharmacotherapy",
        unit: "agents",
        normalRange: "Monotherapy vs Combination",
        description: "Prescribed antihypertensives, antidiabetics, and statins.",
      },
    ],
    sparklineKeys: [],
  },
];

/**
 * Shape cues for color-blind accessibility:
 * Low: Circle (●)
 * Moderate: Triangle (▲)
 * High: Octagon / Diamond (⬢)
 */
export function getRiskShapeCue(tier: RiskTier | string | null | undefined): {
  symbol: string;
  name: string;
  ariaDesc: string;
} {
  const norm = (tier || "LOW").toUpperCase();
  if (norm.includes("HIGH")) {
    return { symbol: "⬢", name: "Octagon", ariaDesc: "High Risk indicator (octagon shape)" };
  }
  if (norm.includes("MED") || norm.includes("MOD")) {
    return { symbol: "▲", name: "Triangle", ariaDesc: "Moderate Risk indicator (triangle shape)" };
  }
  return { symbol: "●", name: "Circle", ariaDesc: "Low Risk indicator (circle shape)" };
}

/**
 * Normal range evaluation helper: returns true if value is within normal limits.
 */
export function evaluateVitalStatus(
  key: string,
  val: number | string | null | undefined
): "normal" | "elevated" | "high" | "unknown" {
  if (val == null) return "unknown";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "unknown";

  switch (key) {
    case "sbp":
      if (num < 120) return "normal";
      if (num < 130) return "elevated";
      return "high";
    case "dbp":
      if (num < 80) return "normal";
      if (num < 89) return "elevated";
      return "high";
    case "hr":
      if (num >= 60 && num <= 100) return "normal";
      return "elevated";
    case "bmi":
      if (num >= 18.5 && num < 25) return "normal";
      if (num >= 25 && num < 30) return "elevated";
      return "high";
    case "glucose":
      if (num < 100) return "normal";
      if (num < 126) return "elevated";
      return "high";
    case "hba1c":
      if (num < 5.7) return "normal";
      if (num < 6.5) return "elevated";
      return "high";
    default:
      return "unknown";
  }
}

"use client";

import React from "react";
import { PatientSimulator } from "./PatientSimulator";
import { SimulateResponse } from "@/lib/api";

interface WhatIfLabProps {
  patientId: string;
  initialSbp?: number;
  initialWeight?: number;
  initialDbp?: number;
  initialHr?: number;
  initialBmi?: number;
  initialGlucose?: number;
  initialHba1c?: number;
  featureRow?: Record<string, any>;
  onScenarioChange?: (res: any, scenarioVitals?: any) => void;
}

export function WhatIfLab({
  patientId,
  initialSbp = 125,
  initialWeight = 70,
  initialDbp = 80,
  initialHr = 72,
  initialBmi = 24.5,
  initialGlucose = 100,
  initialHba1c = 5.6,
  featureRow,
  onScenarioChange,
}: WhatIfLabProps) {
  return (
    <PatientSimulator
      patientId={patientId}
      initialVitals={{
        sbp: initialSbp,
        dbp: initialDbp,
        hr: initialHr,
        weight: initialWeight,
        bmi: initialBmi,
        glucose: initialGlucose,
        hba1c: initialHba1c,
      }}
      featureRow={featureRow}
      onScenarioChange={onScenarioChange}
    />
  );
}

export default WhatIfLab;

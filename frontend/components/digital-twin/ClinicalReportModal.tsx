"use client";

import React, { useEffect } from "react";
import {
  PatientDetail,
  PatientSummary,
  PredictResponse,
  ModelInfo,
  VitalSigns,
  RiskState,
  SnapshotItem,
} from "@/lib/api";
import { ClinicalReportDocument } from "./ClinicalReportDocument";
import { Printer, X, FileText } from "lucide-react";

export interface ClinicalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientDetail | null;
  summary?: PatientSummary | null;
  prediction: PredictResponse | null;
  modelInfo?: ModelInfo | null;
  activeVitals?: VitalSigns;
  activeRisk?: RiskState;
  activeRiskSource?: "counterfactual_simulation" | "historical_replay" | "baseline";
  activeSnapshotIdx?: number;
  currentSnapshot?: SnapshotItem | null;
  simulatedScenario?: {
    res: any;
    vitals?: VitalSigns;
  } | null;
}

export function ClinicalReportModal({
  isOpen,
  onClose,
  patient,
  summary,
  prediction,
  modelInfo,
  activeVitals,
  activeRisk,
  activeRiskSource = "baseline",
  activeSnapshotIdx = 0,
  currentSnapshot,
  simulatedScenario,
}: ClinicalReportModalProps) {
  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto print:static print:p-0 print:bg-transparent print:overflow-visible print:z-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clinical-report-modal-title"
    >
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto print:border-none print:shadow-none print:max-w-none print:w-full print:m-0 print:rounded-none print:bg-white">
        {/* Modal Action Header (hidden in print) */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 print:hidden no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2
              id="clinical-report-modal-title"
              className="text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              Clinical AI Risk Assessment Report Preview
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Close report preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Container on Screen, Pure Document in Print */}
        <div className="max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible">
          <ClinicalReportDocument
            patient={patient}
            summary={summary}
            prediction={prediction}
            modelInfo={modelInfo}
            activeVitals={activeVitals}
            activeRisk={activeRisk}
            activeRiskSource={activeRiskSource}
            activeSnapshotIdx={activeSnapshotIdx}
            currentSnapshot={currentSnapshot}
            simulatedScenario={simulatedScenario}
          />
        </div>
      </div>
    </div>
  );
}

export default ClinicalReportModal;

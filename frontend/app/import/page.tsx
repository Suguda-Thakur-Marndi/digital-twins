"use client";

import React, { useState } from "react";
import Link from "next/link";
import { postFHIRImport, postStreamReading, FHIRMappingReport, StreamReadingResponse } from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Bluetooth,
  ArrowRight,
  Database,
  FileCode,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  Check,
} from "lucide-react";

// Realistic sample ABDM-compatible FHIR Bundle
const SAMPLE_ABDM_FHIR_BUNDLE = {
  resourceType: "Bundle",
  type: "collection",
  id: "abdm-bundle-sample-001",
  entry: [
    {
      resource: {
        resourceType: "Patient",
        id: "pt-abdm-sample",
        identifier: [
          {
            system: "https://healthid.ndhm.gov.in",
            value: "91-4421-8890-1204",
          },
        ],
        name: [{ text: "Ramesh Kumar" }],
        gender: "male",
        birthDate: "1972-04-15",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }],
        },
        valueQuantity: { value: 148, unit: "mmHg" },
        effectiveDateTime: "2026-03-01T10:15:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }],
        },
        valueQuantity: { value: 94, unit: "mmHg" },
        effectiveDateTime: "2026-03-01T10:15:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }],
        },
        valueQuantity: { value: 78, unit: "beats/min" },
        effectiveDateTime: "2026-03-01T10:15:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body weight" }],
        },
        valueQuantity: { value: 76.5, unit: "kg" },
        effectiveDateTime: "2026-03-01T10:15:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "39156-5", display: "Body mass index" }],
        },
        valueQuantity: { value: 27.2, unit: "kg/m2" },
        effectiveDateTime: "2026-03-01T10:15:00Z",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "4548-4", display: "HbA1c" }],
        },
        valueQuantity: { value: 6.8, unit: "%" },
        effectiveDateTime: "2026-03-01T10:15:00Z",
      },
    },
    {
      resource: {
        resourceType: "Condition",
        code: {
          coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertensive disorder" }],
        },
        clinicalStatus: { coding: [{ code: "active" }] },
      },
    },
    {
      resource: {
        resourceType: "MedicationStatement",
        status: "active",
        medicationCodeableConcept: {
          text: "Amlodipine 5mg Oral Tablet",
        },
      },
    },
  ],
};

const SAMPLE_DEVICE_CSV = `timestamp,sbp,dbp,hr,spo2
2026-03-01T08:00:00,136,86,72,98
2026-03-01T20:00:00,142,88,76,97
2026-03-02T08:15:00,138,84,70,98
2026-03-02T20:30:00,144,92,80,96
2026-03-03T07:45:00,140,88,74,98`;

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<"fhir" | "device">("fhir");

  // FHIR State
  const [fhirInput, setFhirInput] = useState<string>("");
  const [fhirLoading, setFhirLoading] = useState<boolean>(false);
  const [fhirReport, setFhirReport] = useState<FHIRMappingReport | null>(null);
  const [fhirError, setFhirError] = useState<string | null>(null);

  // Low-Cost Device State
  const [devicePatientId, setDevicePatientId] = useState<string>("PT-101");
  const [deviceSbp, setDeviceSbp] = useState<number>(138);
  const [deviceDbp, setDeviceDbp] = useState<number>(88);
  const [deviceHr, setDeviceHr] = useState<number>(76);
  const [deviceSpo2, setDeviceSpo2] = useState<number>(98);
  const [deviceModel, setDeviceModel] = useState<string>("Bluetooth Cuff (Omron/Dr. Morepen)");
  const [csvContent, setCsvContent] = useState<string>("");
  const [deviceLoading, setDeviceLoading] = useState<boolean>(false);
  const [deviceSuccess, setDeviceSuccess] = useState<string | null>(null);
  const [deviceAlerts, setDeviceAlerts] = useState<string[]>([]);

  // Load sample FHIR
  const handleLoadSampleFHIR = () => {
    setFhirInput(JSON.stringify(SAMPLE_ABDM_FHIR_BUNDLE, null, 2));
    setFhirError(null);
    setFhirReport(null);
  };

  // Run FHIR Ingestion
  const handleProcessFHIR = async () => {
    setFhirLoading(true);
    setFhirError(null);
    setFhirReport(null);
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(fhirInput);
      } catch {
        throw new Error("Invalid JSON format. Please paste a valid FHIR Bundle JSON.");
      }
      const res = await postFHIRImport(parsed);
      setFhirReport(res);
    } catch (err: any) {
      setFhirError(err?.message || "Failed to process FHIR Bundle.");
    } finally {
      setFhirLoading(false);
    }
  };

  // Process Device Manual Reading
  const handleSendDeviceReading = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceLoading(true);
    setDeviceSuccess(null);
    setDeviceAlerts([]);
    try {
      const res = await postStreamReading({
        patient_id: devicePatientId,
        reading_type: "bluetooth_vitals",
        sbp: deviceSbp,
        dbp: deviceDbp,
        hr: deviceHr,
        spo2: deviceSpo2,
      });
      setDeviceSuccess(
        `Reading ingested successfully from ${deviceModel}. Twin state updated for ${devicePatientId}.`
      );
      if (res.alert_flags && res.alert_flags.length > 0) {
        setDeviceAlerts(res.alert_flags);
      }
    } catch (err: any) {
      setDeviceSuccess(null);
      alert(err?.message || "Failed to transmit reading.");
    } finally {
      setDeviceLoading(false);
    }
  };

  // Process CSV Upload
  const handleProcessCsv = async () => {
    if (!csvContent.trim()) return;
    setDeviceLoading(true);
    setDeviceSuccess(null);
    setDeviceAlerts([]);
    try {
      const lines = csvContent.trim().split("\n");
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      let count = 0;
      let lastAlerts: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length < 3) continue;
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = parts[idx];
        });

        const sbp = row.sbp ? Number(row.sbp) : undefined;
        const dbp = row.dbp ? Number(row.dbp) : undefined;
        const hr = row.hr ? Number(row.hr) : undefined;
        const spo2 = row.spo2 ? Number(row.spo2) : undefined;

        const res = await postStreamReading({
          patient_id: devicePatientId,
          reading_type: "csv_batch",
          sbp,
          dbp,
          hr,
          spo2,
          timestamp: row.timestamp,
        });
        count++;
        if (res.alert_flags) lastAlerts = res.alert_flags;
      }
      setDeviceSuccess(`Successfully ingested ${count} readings from CSV into twin for ${devicePatientId}.`);
      setDeviceAlerts(lastAlerts);
    } catch (err: any) {
      alert(err?.message || "Failed to process CSV.");
    } finally {
      setDeviceLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              ABDM Ingestion Layer
            </span>
            <span className="text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 px-2 py-0.5 rounded-full font-bold">
              FHIR R4 Aligned
            </span>
            <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-full font-bold">
              Synthetic EHR
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Patient Record &amp; Telemetry Ingestion
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl mt-0.5 leading-relaxed">
            Ingest structured ABDM FHIR R4 Bundles and Bluetooth oscillometric cuff streams directly into the 132-feature matrix.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 glass-card p-1 border border-[var(--border-subtle)] rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("fhir")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "fhir"
                ? "bg-[var(--color-primary)] text-white font-bold shadow-xs"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            FHIR Bundle JSON
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("device")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === "device"
                ? "bg-[var(--color-primary)] text-white font-bold shadow-xs"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            Bluetooth &amp; CSV
          </button>
        </div>
      </div>

      {/* ── TAB 1: FHIR BUNDLE INGESTION ──────────────────────────────────── */}
      {activeTab === "fhir" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: JSON Editor & Controls */}
          <div className="lg:col-span-6 space-y-4">
            <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[var(--accent-teal)]" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Paste ABDM FHIR Bundle JSON
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleFHIR}
                  className="text-xs text-[var(--accent-teal)] hover:underline font-mono"
                >
                  Load Sample ABDM Record
                </button>
              </div>

              <textarea
                rows={16}
                value={fhirInput}
                onChange={(e) => setFhirInput(e.target.value)}
                placeholder="Paste valid FHIR Bundle JSON here (with Patient, Observation, Condition resources)..."
                className="w-full p-3 font-mono text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)] leading-relaxed"
              />

              {fhirError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Validation Error:</strong>
                    <div className="text-[11px] mt-0.5">{fhirError}</div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Schema target: 132-feature XGBoost
                </span>
                <button
                  type="button"
                  onClick={handleProcessFHIR}
                  disabled={fhirLoading || !fhirInput.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Upload className={`w-3.5 h-3.5 ${fhirLoading ? "animate-spin" : ""}`} />
                  <span>{fhirLoading ? "Mapping Bundle…" : "Validate & Map Record"}</span>
                </button>
              </div>
            </div>

            {/* Indian Context Note */}
            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded text-xs text-amber-950 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <Info className="w-4 h-4 text-amber-600" />
                <span>ABDM Architecture Alignment & Clinical Population Scope</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-900">
                This ingestion module accepts standard ABDM Health Information Provider (HIP) payloads. 
                <strong> Important note:</strong> The downstream predictive model was trained on synthetic 
                EHR data and has not been clinically validated on Indian populations. Hypertension staging 
                guidelines follow the <em>Indian Guidelines on Hypertension (IGH-IV / ICMR, 140/90 mmHg)</em>.
              </p>
            </div>
          </div>

          {/* Right Column: Mapping Report & Projection */}
          <div className="lg:col-span-6 space-y-4">
            {fhirReport ? (
              <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      FHIR Mapping Verification Report
                    </h3>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                      fhirReport.valid
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-rose-100 text-rose-800 border border-rose-300"
                    }`}
                  >
                    {fhirReport.valid ? "VALID BUNDLE" : "INVALID BUNDLE"}
                  </span>
                </div>

                {/* Demographics Summary */}
                <div className="grid grid-cols-3 gap-2.5 p-3 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)] text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block uppercase">Patient ID</span>
                    <strong className="text-[var(--text-primary)]">{fhirReport.patient_id || "Anonymous"}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block uppercase">Age</span>
                    <strong className="text-[var(--text-primary)]">{fhirReport.demographics?.age ?? "—"} years</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block uppercase">Gender</span>
                    <strong className="text-[var(--text-primary)]">{fhirReport.demographics?.gender ?? "—"}</strong>
                  </div>
                </div>

                {/* Mapping Counts */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 border rounded bg-white">
                    <span className="text-lg font-bold font-mono text-[var(--accent-teal)]">
                      {fhirReport.observations_mapped}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Observations</span>
                  </div>
                  <div className="p-2 border rounded bg-white">
                    <span className="text-lg font-bold font-mono text-[var(--accent-teal)]">
                      {fhirReport.conditions_mapped}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Conditions</span>
                  </div>
                  <div className="p-2 border rounded bg-white">
                    <span className="text-lg font-bold font-mono text-[var(--accent-teal)]">
                      {fhirReport.medications_mapped}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Medications</span>
                  </div>
                  <div className="p-2 border rounded bg-white">
                    <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                      {fhirReport.features_populated}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block">Features Populated</span>
                  </div>
                </div>

                {/* Validation Warnings */}
                {fhirReport.validation_errors.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-1 text-xs text-amber-900">
                    <strong className="font-bold">Schema Notice:</strong>
                    <ul className="list-disc pl-4 text-[11px] space-y-0.5">
                      {fhirReport.validation_errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Mapped Fields Table */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase font-mono">
                    Extracted & Mapped Clinical Parameters ({fhirReport.mapping_summary.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto border rounded text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-[var(--bg-subtle)] sticky top-0 text-[10px] text-[var(--text-muted)] uppercase font-mono">
                        <tr>
                          <th className="p-2">Model Target Field</th>
                          <th className="p-2">FHIR Source Resource</th>
                          <th className="p-2 text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)] font-mono text-[11px]">
                        {fhirReport.mapping_summary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 font-semibold text-[var(--text-primary)]">{row.field}</td>
                            <td className="p-2 text-[var(--text-muted)]">{row.source}</td>
                            <td className="p-2 text-right font-bold text-[var(--accent-teal)]">{row.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Simulated Prediction Projection */}
                {fhirReport.simulated_prediction && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded space-y-2">
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-600 block">
                      Initial Model Projection for Imported Record
                    </span>
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
                          {(fhirReport.simulated_prediction.calibrated_risk * 100).toFixed(1)}%
                        </span>
                        <span className={RISK_BADGE_CLASSES[normalizeTier(fhirReport.simulated_prediction.risk_tier)]}>
                          {fhirReport.simulated_prediction.risk_tier} Risk
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)]">
                        Raw Proba: {fhirReport.simulated_prediction.raw_score.toFixed(4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[var(--text-muted)] bg-white rounded border border-dashed border-[var(--border-hairline)] space-y-2">
                <Database className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Paste or load an ABDM FHIR Bundle on the left and click &ldquo;Validate & Map Record&rdquo;.</p>
                <p className="text-[11px] text-[var(--text-faint)]">
                  The system will inspect Patient, Observation, Condition, and MedicationStatement resources and map them into the 132 model features.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: LOW-COST DEVICE INGESTION ──────────────────────────────── */}
      {activeTab === "device" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Direct Bluetooth Form */}
          <div className="lg:col-span-6 space-y-4">
            <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] space-y-4">
              <div className="flex items-center gap-2 border-b border-[var(--border-hairline)] pb-3">
                <Bluetooth className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Low-Cost Bluetooth Device Ingestion
                  </h3>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    Compatible with Omron HEM-7120, Dr. Morepen, Beurer & fingertip oximeters
                  </span>
                </div>
              </div>

              <form onSubmit={handleSendDeviceReading} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-[var(--text-primary)] mb-1">
                    Select Digital Twin Patient:
                  </label>
                  <input
                    type="text"
                    value={devicePatientId}
                    onChange={(e) => setDevicePatientId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded font-mono text-xs bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[var(--text-primary)] mb-1">
                      Systolic BP (mmHg)
                    </label>
                    <input
                      type="number"
                      min={70}
                      max={220}
                      value={deviceSbp}
                      onChange={(e) => setDeviceSbp(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border rounded font-mono text-xs bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[var(--text-primary)] mb-1">
                      Diastolic BP (mmHg)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={140}
                      value={deviceDbp}
                      onChange={(e) => setDeviceDbp(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border rounded font-mono text-xs bg-white font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-[var(--text-primary)] mb-1">
                      Heart Rate (bpm)
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={180}
                      value={deviceHr}
                      onChange={(e) => setDeviceHr(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border rounded font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-[var(--text-primary)] mb-1">
                      SpO2 Oxygen (%)
                    </label>
                    <input
                      type="number"
                      min={80}
                      max={100}
                      value={deviceSpo2}
                      onChange={(e) => setDeviceSpo2(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 border rounded font-mono text-xs bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[var(--text-primary)] mb-1">
                    Device Identifier / Source:
                  </label>
                  <input
                    type="text"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded font-mono text-xs bg-[var(--bg-subtle)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deviceLoading}
                  className="w-full py-2 px-3 rounded text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] transition-colors disabled:opacity-50"
                >
                  {deviceLoading ? "Ingesting Telemetry…" : "Transmit Bluetooth Telemetry Reading"}
                </button>
              </form>

              {deviceSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-xs flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Ingestion Confirmed:</strong>
                    <div className="text-[11px] mt-0.5">{deviceSuccess}</div>
                  </div>
                </div>
              )}

              {deviceAlerts.length > 0 && (
                <div className="space-y-1.5">
                  {deviceAlerts.map((flag, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="font-medium text-[11px] leading-relaxed">{flag}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Batch CSV Upload */}
          <div className="lg:col-span-6 space-y-4">
            <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-2">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[var(--accent-teal)]" />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Batch CSV Ambulatory Log Upload
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCsvContent(SAMPLE_DEVICE_CSV)}
                  className="text-xs text-[var(--accent-teal)] hover:underline font-mono"
                >
                  Load Sample CSV
                </button>
              </div>

              <textarea
                rows={10}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="Paste CSV logs with columns: timestamp, sbp, dbp, hr, spo2..."
                className="w-full p-3 font-mono text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)] leading-relaxed"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Logs ingest directly into 7-day rolling window
                </span>
                <button
                  type="button"
                  onClick={handleProcessCsv}
                  disabled={deviceLoading || !csvContent.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-[var(--accent-teal)] text-white hover:bg-[var(--accent-teal-hover)] disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Process CSV Log</span>
                </button>
              </div>
            </div>

            {/* Quick Link to Twin */}
            <div className="p-4 bg-white border border-[var(--border-hairline)] rounded flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  Verify Ingested Telemetry on Twin Dashboard
                </h4>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Open {devicePatientId} to inspect live vitals and recomputed risk trajectory.
                </p>
              </div>
              <Link
                href={`/twin?patient=${devicePatientId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-teal)] hover:underline"
              >
                <span>View Twin</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { TimelineVitalItem, ConditionItem, MedicationItem } from "@/lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Table, Pill, HeartPulse } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface LongitudinalChartsProps {
  timeline: TimelineVitalItem[];
  conditions?: ConditionItem[];
  medications?: MedicationItem[];
}

export function LongitudinalCharts({
  timeline,
  conditions = [],
  medications = [],
}: LongitudinalChartsProps) {
  const [showTable, setShowTable] = useState(false);
  const [activeTab, setActiveTab] = useState<"bp" | "weight">("bp");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (!timeline || timeline.length === 0) {
    return (
      <div className="glass-card p-6 border border-[var(--glass-border)] text-center text-xs text-[var(--text-muted)]">
        No longitudinal clinical recordings available for this patient.
      </div>
    );
  }

  // Format data for chart
  const chartData = timeline.map((pt) => ({
    date: pt.date,
    sbp: pt.sbp,
    dbp: pt.dbp,
    weight: pt.weight,
    bmi: pt.bmi,
    pulse_pressure: pt.sbp - pt.dbp,
  }));

  const gridStroke = isDark ? "rgba(148, 183, 220, 0.12)" : "rgba(203, 219, 238, 0.6)";
  const axisColor = isDark ? "#CBD5E1" : "#334155";
  const tooltipBg = isDark ? "rgba(15, 29, 48, 0.95)" : "rgba(255, 255, 255, 0.98)";
  const tooltipBorder = isDark ? "rgba(148, 183, 220, 0.24)" : "rgba(203, 219, 238, 0.8)";
  const tooltipTextColor = isDark ? "#FFFFFF" : "#0F172A";

  return (
    <div className="glass-card p-5 border border-[var(--glass-border)] space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
            Longitudinal EHR Trajectory
          </span>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            Physiological Progression Across Time
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-xl border border-[var(--glass-border)] p-0.5 bg-[var(--bg-subtle)] text-xs backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveTab("bp")}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium cursor-pointer ${
                activeTab === "bp"
                  ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] font-semibold shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Blood Pressure
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("weight")}
              className={`px-3 py-1.5 rounded-lg transition-all font-medium cursor-pointer ${
                activeTab === "weight"
                  ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] font-semibold shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              Weight & BMI
            </button>
          </div>

          {/* Accessible Table Fallback Toggle */}
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--glass-border)] rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-strong)] transition-colors cursor-pointer"
            title="Toggle data table alternative for accessibility"
          >
            <Table className="w-3.5 h-3.5" />
            <span>{showTable ? "Hide Table" : "Data Table"}</span>
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      {!showTable ? (
        <div className="space-y-2">
          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === "bp" ? (
                <LineChart data={chartData} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="monospace"
                  />
                  <YAxis
                    domain={[60, 180]}
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="monospace"
                    unit=" mmHg"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      color: tooltipTextColor,
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                      backdropFilter: "blur(16px)",
                    }}
                  />
                  {/* Clinical reference thresholds */}
                  <ReferenceLine
                    y={140}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: "Stage 2 SBP (140)",
                      position: "insideTopRight",
                      fill: "#ef4444",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                  <ReferenceLine
                    y={90}
                    stroke="#f97316"
                    strokeDasharray="4 4"
                    strokeWidth={1.2}
                    label={{
                      value: "Stage 2 DBP (90)",
                      position: "insideBottomRight",
                      fill: "#f97316",
                      fontSize: 10,
                      fontFamily: "monospace",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sbp"
                    name="Systolic BP"
                    stroke={isDark ? "#38bdf8" : "#0284c7"}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: isDark ? "#38bdf8" : "#0284c7" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dbp"
                    name="Diastolic BP"
                    stroke={isDark ? "#818cf8" : "#4f46e5"}
                    strokeWidth={2}
                    dot={{ r: 3, fill: isDark ? "#818cf8" : "#4f46e5" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 12, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="monospace"
                  />
                  <YAxis
                    stroke={axisColor}
                    fontSize={11}
                    tickLine={false}
                    fontFamily="monospace"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      borderColor: tooltipBorder,
                      color: tooltipTextColor,
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                      backdropFilter: "blur(16px)",
                    }}
                  />
                  <ReferenceLine
                    y={25}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: "Overweight BMI (25.0)",
                      position: "insideTopRight",
                      fill: "#f59e0b",
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bmi"
                    name="BMI (kg/m²)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f59e0b" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Weight (kg)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#10b981" }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] font-mono px-2 pt-1 border-t border-[var(--border-hairline)]">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              {activeTab === "bp" ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span>Systolic BP</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    <span>Diastolic BP</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>BMI</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Weight (kg)</span>
                  </span>
                </>
              )}
            </div>
            <span>{chartData.length} observation points recorded</span>
          </div>
        </div>
      ) : (
        /* Accessible Table Fallback */
        <div className="overflow-x-auto responsive-table-container rounded-xl border border-[var(--glass-border)]">
          <table className="w-full min-w-[560px] text-xs font-mono text-left">
            <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-b border-[var(--glass-border)]">
              <tr>
                <th className="p-2.5">Date</th>
                <th className="p-2.5">SBP (mmHg)</th>
                <th className="p-2.5">DBP (mmHg)</th>
                <th className="p-2.5">Pulse Pressure</th>
                <th className="p-2.5">Weight (kg)</th>
                <th className="p-2.5">BMI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {chartData.map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="p-2.5 font-semibold text-[var(--text-primary)]">{row.date}</td>
                  <td className="p-2.5">{row.sbp}</td>
                  <td className="p-2.5">{row.dbp}</td>
                  <td className="p-2.5">{row.pulse_pressure}</td>
                  <td className="p-2.5">{row.weight ? row.weight.toFixed(1) : "—"}</td>
                  <td className="p-2.5">{row.bmi ? row.bmi.toFixed(1) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conditions & Medications tags */}
      {(conditions.length > 0 || medications.length > 0) && (
        <div className="pt-3 border-t border-[var(--border-hairline)] grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {conditions.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                <span>Recorded Chronic Conditions:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((c, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] font-mono text-[11px]"
                  >
                    {c.display_name || c.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {medications.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-cyan-500" />
                <span>Active Prescriptions:</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {medications.map((m, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-hairline)] text-[var(--text-secondary)] font-mono text-[11px]"
                  >
                    {m.display_name || m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchSimulatedWearable,
  postStreamReading,
  WearableResponse,
  StreamReadingResponse,
} from "@/lib/api";
import {
  Watch,
  Heart,
  Flame,
  ShieldAlert,
  Activity,
  Moon,
  Send,
  Play,
  Pause,
  AlertTriangle,
  Radio,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface WearablePanelProps {
  patientId: string;
  onLiveReadingAccepted?: (reading: StreamReadingResponse) => void;
}

export function WearablePanel({ patientId, onLiveReadingAccepted }: WearablePanelProps) {
  const [data, setData] = useState<WearableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSendForm, setShowSendForm] = useState(false);
  const [autoSimulate, setAutoSimulate] = useState(false);

  // Send Reading Form State
  const [inputSbp, setInputSbp] = useState(132);
  const [inputDbp, setInputDbp] = useState(84);
  const [inputHr, setInputHr] = useState(74);
  const [inputSpo2, setInputSpo2] = useState(98);
  const [inputSteps, setInputSteps] = useState(6500);
  const [sending, setSending] = useState(false);
  const [lastStreamTime, setLastStreamTime] = useState<string | null>(null);

  const autoSimTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load baseline 14-day stream
  const loadFeed = useCallback(() => {
    setLoading(true);
    fetchSimulatedWearable(patientId, 14)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error("Wearable stream simulation failed:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [patientId]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Dispatch a single live reading
  const handleSendReading = async (
    customVals?: { sbp?: number; dbp?: number; hr?: number; spo2?: number; steps?: number }
  ) => {
    setSending(true);
    try {
      const payload = {
        patient_id: patientId,
        reading_type: "bp",
        sbp: customVals?.sbp ?? inputSbp,
        dbp: customVals?.dbp ?? inputDbp,
        hr: customVals?.hr ?? inputHr,
        spo2: customVals?.spo2 ?? inputSpo2,
        steps: customVals?.steps ?? inputSteps,
      };
      const res = await postStreamReading(payload);
      setLastStreamTime(new Date().toLocaleTimeString());
      if (onLiveReadingAccepted) {
        onLiveReadingAccepted(res);
      }
      // Refresh feed to show newly appended reading
      fetchSimulatedWearable(patientId, 14).then((d) => setData(d));
    } catch (err) {
      console.error("Failed to post stream reading:", err);
    } finally {
      setSending(false);
    }
  };

  // Auto-simulate ticker
  useEffect(() => {
    if (autoSimulate) {
      autoSimTimerRef.current = setInterval(() => {
        const sbpNoise = Math.floor(Math.random() * 14) - 7;
        const dbpNoise = Math.floor(Math.random() * 8) - 4;
        const hrNoise = Math.floor(Math.random() * 6) - 3;
        handleSendReading({
          sbp: 128 + sbpNoise,
          dbp: 82 + dbpNoise,
          hr: 72 + hrNoise,
          spo2: 97 + Math.floor(Math.random() * 3),
          steps: Math.floor(Math.random() * 800) + 200,
        });
      }, 4000);
    } else {
      if (autoSimTimerRef.current) clearInterval(autoSimTimerRef.current);
    }
    return () => {
      if (autoSimTimerRef.current) clearInterval(autoSimTimerRef.current);
    };
  }, [autoSimulate, patientId]);

  if (loading && !data) {
    return (
      <div className="clinical-card p-6 bg-white border-[var(--border-hairline)] animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/4" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.daily_readings.map((r) => ({
    date: r.date.slice(5),
    hr: r.resting_heart_rate,
    steps: r.daily_steps,
    home_sbp: r.home_sbp_mean,
    home_dbp: r.home_dbp_mean,
    sleep: r.sleep_hours,
  }));

  return (
    <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs space-y-4">
      {/* Header with Mandatory SIMULATED Tag */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <Watch className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Ambulatory Telemetry
              </span>
              <span className="badge-simulated">SIMULATED DATA</span>
              {autoSimulate && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-bold animate-pulse">
                  <Radio className="w-3 h-3 text-emerald-600" /> LIVE STREAMING
                </span>
              )}
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              Continuous Wearables & Home BP Telemetry
            </h4>
          </div>
        </div>

        {/* Stream Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSimulate(!autoSimulate)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded border transition-colors ${
              autoSimulate
                ? "bg-emerald-600 text-white border-emerald-700"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            {autoSimulate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{autoSimulate ? "Stop Stream" : "Auto-Simulate"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSendForm(!showSendForm)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[var(--bg-subtle)] border border-[var(--border-hairline)] rounded hover:bg-[var(--bg-panel)] text-[var(--text-primary)] transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Send Reading</span>
          </button>
        </div>
      </div>

      {/* Manual Reading Ingest Drawer */}
      {showSendForm && (
        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900/50 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
            <span>Send New Bluetooth Device / Wearable Reading</span>
            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">Simulates real-time IoT ingestion</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
            <div>
              <label htmlFor="wb-sbp" className="text-[10px] text-[var(--text-muted)] block">Home SBP</label>
              <input
                id="wb-sbp"
                type="number"
                value={inputSbp}
                onChange={(e) => setInputSbp(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
              />
            </div>
            <div>
              <label htmlFor="wb-dbp" className="text-[10px] text-[var(--text-muted)] block">Home DBP</label>
              <input
                id="wb-dbp"
                type="number"
                value={inputDbp}
                onChange={(e) => setInputDbp(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
              />
            </div>
            <div>
              <label htmlFor="wb-hr" className="text-[10px] text-[var(--text-muted)] block">Heart Rate</label>
              <input
                id="wb-hr"
                type="number"
                value={inputHr}
                onChange={(e) => setInputHr(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
              />
            </div>
            <div>
              <label htmlFor="wb-spo2" className="text-[10px] text-[var(--text-muted)] block">SpO2 %</label>
              <input
                id="wb-spo2"
                type="number"
                value={inputSpo2}
                onChange={(e) => setInputSpo2(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="wb-steps" className="text-[10px] text-[var(--text-muted)] block">Steps</label>
              <input
                id="wb-steps"
                type="number"
                value={inputSteps}
                onChange={(e) => setInputSteps(Number(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-[var(--border-hairline)] rounded bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleSendReading()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--accent-teal)] text-white rounded hover:bg-[var(--accent-teal-hover)] transition-colors disabled:opacity-50 min-h-[36px]"
            >
              <Send className="w-3 h-3" />
              <span>{sending ? "Sending…" : "Ingest Reading Now"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ALERT RULES ENGINE FLAGS */}
      {data.alert_flags && data.alert_flags.length > 0 && (
        <div className="space-y-1.5">
          {data.alert_flags.map((flag: string, idx: number) => (
            <div
              key={idx}
              className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs flex items-start gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{flag}</div>
            </div>
          ))}
        </div>
      )}

      {/* 7-DAY SUMMARY FEATURES WITH VARIABILITY */}
      <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-500" />
              7d Resting HR
            </span>
            <span className="badge-simulated">SIM</span>
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {data.summary.avg_resting_hr}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">bpm</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
            SD: ±{data.summary.resting_hr_std ?? 2.4} bpm
          </div>
        </div>

        <div className="p-2.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" />
              7d Daily Steps
            </span>
            <span className="badge-simulated">SIM</span>
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {data.summary.avg_daily_steps.toLocaleString()}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">steps</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
            Target: 7,500/day
          </div>
        </div>

        <div className="p-2.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-[var(--accent-teal)]" />
              7d Home BP Mean
            </span>
            <span className="badge-simulated">SIM</span>
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {Math.round(data.summary.avg_home_sbp)}/{Math.round(data.summary.avg_home_dbp)}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">mmHg</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
            SBP Variability: ±{data.summary.home_sbp_std ?? 5.2} mmHg
          </div>
        </div>

        <div className="p-2.5 bg-[var(--bg-subtle)] rounded border border-[var(--border-hairline)]">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <Moon className="w-3 h-3 text-indigo-500" />
              7d Mean Sleep
            </span>
            <span className="badge-simulated">SIM</span>
          </div>
          <div className="mt-1 text-xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {data.summary.avg_sleep_hours}{" "}
            <span className="text-xs font-normal text-[var(--text-muted)]">hrs</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
            SpO2: {data.summary.avg_spo2 ?? 97.4}%
          </div>
        </div>
      </div>

      {/* Telemetry Chart: Daily HR and Home SBP */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
          <span className="font-medium text-[var(--text-secondary)]">
            Continuous Home Telemetry Stream ({data.days_count} Readings)
          </span>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-[var(--accent-teal)]">
              <span className="w-2.5 h-0.5 bg-[var(--accent-teal)]" />
              Home SBP (Mean)
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              <span className="w-2.5 h-0.5 bg-rose-500" />
              Resting HR
            </span>
          </div>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                fontFamily="monospace"
              />
              <YAxis
                stroke="var(--text-secondary)"
                tick={{ fill: "var(--text-secondary)", fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                fontFamily="monospace"
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderColor: "#e5e7eb",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                }}
              />
              <Line type="monotone" dataKey="home_sbp" stroke="#0d5c56" strokeWidth={2} dot={{ r: 2.5 }} name="Home SBP" />
              <Line type="monotone" dataKey="hr" stroke="#e11d48" strokeWidth={1.5} dot={{ r: 2 }} name="Resting HR" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Decoupling Clinical Explanation */}
      <div className="p-2.5 bg-blue-50/70 rounded border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold block">Architecture Note · Wearable Stream Decoupling:</span>
          <p className="mt-0.5 text-[11px] leading-relaxed">
            The trained 132-feature XGBoost model does NOT utilize continuous wearable features.
            This ambulatory telemetry layer acts as an adjustable real-time overlay with an independent clinical rule engine (e.g. sustained home SBP ≥ 140 mmHg) for future ABDM IoT integration.
          </p>
        </div>
      </div>
    </div>
  );
}

export default WearablePanel;

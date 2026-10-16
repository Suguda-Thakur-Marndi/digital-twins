"use client";

import React, { useState, useEffect, useRef } from "react";
import { SnapshotItem } from "@/lib/api";
import { normalizeTier, RISK_BADGE_CLASSES } from "@/lib/types";
import { Play, Pause, SkipBack, SkipForward, Clock, History, AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";

interface RiskReplayProps {
  snapshots: SnapshotItem[];
  currentSnapshotIndex: number;
  onSelectSnapshot: (index: number) => void;
}

export function RiskReplay({
  snapshots,
  currentSnapshotIndex,
  onSelectSnapshot,
}: RiskReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);

  const total = snapshots.length;
  const currentSnap = snapshots[currentSnapshotIndex] || snapshots[0];

  // Early Warning surveillance:
  // Alert threshold: calibrated risk >= 0.05 (5.0%) or tier !== 'Low'
  const firstAlertIdx = snapshots.findIndex(
    (s) => s.calibrated_risk >= 0.05 || normalizeTier(s.risk_tier) !== "Low"
  );
  const eventIdx = snapshots.findIndex((s) => !!s.stage_2_decompensation);

  let leadTimeDays: number | null = null;
  if (firstAlertIdx !== -1 && eventIdx !== -1 && firstAlertIdx <= eventIdx) {
    const alertDate = new Date(snapshots[firstAlertIdx].date).getTime();
    const eventDate = new Date(snapshots[eventIdx].date).getTime();
    leadTimeDays = Math.max(0, Math.round((eventDate - alertDate) / (1000 * 60 * 60 * 24)));
  }

  // Auto-play effect
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = speed === 1 ? 2200 : 1100;
      playTimerRef.current = setTimeout(() => {
        if (currentSnapshotIndex < total - 1) {
          onSelectSnapshot(currentSnapshotIndex + 1);
        } else {
          // Loop back or pause at end
          setIsPlaying(false);
        }
      }, intervalMs);
    }
    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentSnapshotIndex, total, speed, onSelectSnapshot]);

  if (!snapshots || snapshots.length === 0) {
    return null;
  }

  const handleStepBack = () => {
    setIsPlaying(false);
    if (currentSnapshotIndex > 0) {
      onSelectSnapshot(currentSnapshotIndex - 1);
    }
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    if (currentSnapshotIndex < total - 1) {
      onSelectSnapshot(currentSnapshotIndex + 1);
    }
  };

  const togglePlay = () => {
    if (!isPlaying && currentSnapshotIndex === total - 1) {
      onSelectSnapshot(0);
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="glass-card p-5 border border-[var(--glass-border)] space-y-4">
      {/* Header and Context */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-[var(--color-primary)]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                Signature Feature
              </span>
              <span className="text-[10px] bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white px-2 py-0.5 rounded-full font-mono font-bold shadow-2xs">
                Live Replay
              </span>
            </div>
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">
              Longitudinal Risk Evolution Scrubber
            </h4>
          </div>
        </div>

        {/* Current Playback Step Status */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[var(--text-muted)]">Snapshot:</span>
          <span className="font-bold text-[var(--text-primary)]">
            {currentSnapshotIndex + 1} of {total}
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--color-primary)] font-semibold">
            {currentSnap?.date}
          </span>
        </div>
      </div>

      {/* Snapshot Stepper Track */}
      <div className="space-y-3">
        <div className="relative pt-5 pb-2 overflow-x-auto responsive-table-container">
          <div className="min-w-[480px] sm:min-w-0 relative">
            {/* Timeline connecting line */}
            <div className="absolute top-8 left-4 right-4 h-0.5 bg-slate-300 dark:bg-slate-700/60 -z-0" />

            {/* Stepper nodes */}
            <div className="flex items-center justify-between relative z-10 px-2">
              {snapshots.map((snap, idx) => {
                const isSelected = idx === currentSnapshotIndex;
                const isPast = idx < currentSnapshotIndex;
                const isAlertCrossed = idx === firstAlertIdx;
                const isDecompEvent = !!snap.stage_2_decompensation;

                return (
                  <button
                    key={snap.snapshot_id || idx}
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      onSelectSnapshot(idx);
                    }}
                    className={`group relative flex flex-col items-center focus:outline-none transition-transform cursor-pointer min-w-[50px] ${
                      isSelected ? "scale-110" : "hover:scale-105"
                    }`}
                  >
                    {/* Alert / Event Marker Badge above node */}
                    {isDecompEvent ? (
                      <span className="absolute -top-5 text-[9px] font-sans font-bold bg-rose-600 text-white px-1.5 py-0.5 rounded-full shadow-xs whitespace-nowrap animate-bounce">
                        Event 🚨
                      </span>
                    ) : isAlertCrossed ? (
                      <span className="absolute -top-5 text-[9px] font-sans font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full shadow-xs whitespace-nowrap">
                        Alert ⚠️
                      </span>
                    ) : null}

                    {/* Node Circle */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all font-mono text-xs font-bold ${
                        isDecompEvent
                          ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-400/40"
                          : isAlertCrossed
                          ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/40"
                          : isSelected
                          ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] text-white border-white dark:border-slate-800 shadow-lg ring-4 ring-blue-500/30"
                          : isPast
                          ? "bg-[var(--bg-surface-strong)] text-[var(--color-primary)] border-[var(--color-primary)] shadow-2xs"
                          : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-strong)]"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Date and BP label */}
                    <div className="mt-1.5 text-center font-mono">
                      <span className="block text-[10px] text-[var(--text-muted)]">
                        {snap.date.slice(0, 7)}
                      </span>
                      <span className="block text-[11px] font-semibold text-[var(--text-primary)]">
                        {(snap.calibrated_risk * 100).toFixed(1)}%
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Range Slider for granular scrubbing */}
        <div className="px-2">
          <input
            type="range"
            min={0}
            max={total - 1}
            value={currentSnapshotIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onSelectSnapshot(parseInt(e.target.value, 10));
            }}
            className="w-full h-2 rounded-full appearance-none bg-slate-200 dark:bg-slate-700/60 cursor-pointer accent-[var(--color-primary)] focus:outline-none"
          />
        </div>
      </div>

      {/* Early Warning Surveillance & Lead Time Callout Banner */}
      {leadTimeDays !== null && firstAlertIdx !== -1 && eventIdx !== -1 ? (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs flex items-start gap-2.5 backdrop-blur-md">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 w-full">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 inline" />
                Early Warning Lead Time Detected
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40">
                {leadTimeDays.toLocaleString()} Days Lead Time ({Math.round(leadTimeDays / 30.4)} months)
              </span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed text-[11px]">
              Calibrated risk crossed surveillance threshold (≥5.0%) at Snapshot #{firstAlertIdx + 1} on{" "}
              <strong>{snapshots[firstAlertIdx].date}</strong> ({(snapshots[firstAlertIdx].calibrated_risk * 100).toFixed(1)}%). 
              Documented Stage 2 Decompensation occurred at Snapshot #{eventIdx + 1} on <strong>{snapshots[eventIdx].date}</strong>. 
              The digital twin provided <strong>{leadTimeDays.toLocaleString()} days</strong> of advance clinical warning before acute decompensation.
            </p>
          </div>
        </div>
      ) : eventIdx !== -1 ? (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex flex-wrap items-center justify-between gap-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Documented Stage 2 Decompensation on <strong>{snapshots[eventIdx].date}</strong>.</span>
          </div>
          <span className="text-[10px] font-mono text-rose-600 dark:text-rose-300 font-semibold bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
            Acute Event
          </span>
        </div>
      ) : firstAlertIdx !== -1 ? (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Risk first breached threshold (≥5.0%) on <strong>{snapshots[firstAlertIdx].date}</strong>. Patient in surveillance window.</span>
          </div>
          <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
            Active Surveillance
          </span>
        </div>
      ) : null}

      {/* Playback Controls & Snapshot State Summary */}
      <div className="p-3.5 glass-panel rounded-xl border border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-3">
        {/* Play / Pause / Step Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleStepBack}
            disabled={currentSnapshotIndex === 0}
            className="p-2 rounded-xl glass-btn-secondary disabled:opacity-40 transition-colors cursor-pointer"
            title="Step backward"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-xs cursor-pointer ${
              isPlaying
                ? "bg-amber-600 hover:bg-amber-500"
                : "glass-btn-primary"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Play Replay</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleStepForward}
            disabled={currentSnapshotIndex === total - 1}
            className="p-2 rounded-xl glass-btn-secondary disabled:opacity-40 transition-colors cursor-pointer"
            title="Step forward"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Speed toggle */}
          <button
            type="button"
            onClick={() => setSpeed(speed === 1 ? 2 : 1)}
            className="ml-1 px-2.5 py-1.5 rounded-xl text-[11px] font-mono glass-btn-secondary cursor-pointer"
          >
            {speed}x Speed
          </button>
        </div>

        {/* Snapshot Active State Indicators */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div>
            <span className="text-[var(--text-muted)] mr-1">BP:</span>
            <strong className="text-[var(--text-primary)]">
              {currentSnap?.sbp ? `${Math.round(currentSnap.sbp)}/${Math.round(currentSnap.dbp || 80)}` : "—"} mmHg
            </strong>
          </div>
          <div>
            <span className="text-[var(--text-muted)] mr-1">Risk:</span>
            <strong className="text-[var(--text-primary)]">
              {(currentSnap.calibrated_risk * 100).toFixed(1)}%
            </strong>
          </div>
          <span className={RISK_BADGE_CLASSES[normalizeTier(currentSnap.risk_tier)]}>
            {normalizeTier(currentSnap.risk_tier)}
          </span>
          {currentSnap.stage_2_decompensation && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">
              Stage 2 Decompensation Event
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

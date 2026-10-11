"use client";

import { useState, useEffect, useRef } from "react";
import { TimelineSnapshot, fetchTimeline } from "@/lib/api";
import { RISK_COLORS, RiskTier } from "@/lib/types";

interface RiskTimelineProps {
  patientId: string | null;
}

function TimelinePoint({
  snap,
  active,
  onClick,
}: {
  snap: TimelineSnapshot;
  active: boolean;
  onClick: () => void;
}) {
  const tier = snap.risk_tier as RiskTier;
  const color = RISK_COLORS[tier] ?? "#94a3b8";

  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onClick}>
      <div
        className={`relative w-4 h-4 rounded-full border-2 transition-all duration-300 ${
          active ? "scale-125 shadow-lg" : "group-hover:scale-110"
        }`}
        style={{
          borderColor: color,
          background: active ? color : "transparent",
          boxShadow: active ? `0 0 8px ${color}60` : undefined,
        }}
      />
      <div className="text-[8px] text-slate-500 whitespace-nowrap">
        {snap.prediction_time?.slice(0, 7) ?? "—"}
      </div>
      <div
        className="text-[8px] font-semibold"
        style={{ color }}
      >
        {tier}
      </div>
    </div>
  );
}

export default function RiskTimeline({ patientId }: RiskTimelineProps) {
  const [snapshots, setSnapshots] = useState<TimelineSnapshot[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!patientId) {
      setSnapshots([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchTimeline(patientId)
      .then((res: { snapshots: TimelineSnapshot[] }) => {
        setSnapshots(res.snapshots);
        setActiveIdx(res.snapshots.length - 1);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    if (playing && snapshots.length > 1) {
      timerRef.current = setInterval(() => {
        setActiveIdx((prev) => {
          if (prev >= snapshots.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 800);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, snapshots.length]);

  const startReplay = () => {
    setActiveIdx(0);
    setPlaying(true);
  };

  if (!patientId) {
    return (
      <div className="text-slate-500 text-xs text-center py-4">
        Select a patient to view timeline
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <div className="w-3 h-3 border border-slate-600 border-t-transparent rounded-full animate-spin" />
        Loading timeline…
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  if (snapshots.length === 0) {
    return <p className="text-xs text-slate-500">No timeline data available.</p>;
  }

  const active = snapshots[activeIdx];

  return (
    <div>
      {/* Scrollable timeline */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-end gap-6 min-w-max px-2 py-1">
          {/* Line connector */}
          <div className="relative flex items-center gap-0">
            <div className="absolute top-2 left-0 right-0 h-px bg-slate-700" style={{ zIndex: 0 }} />
            <div className="relative flex items-end gap-6" style={{ zIndex: 1 }}>
              {snapshots.map((snap, i) => (
                <TimelinePoint
                  key={snap.prediction_time ?? i}
                  snap={snap}
                  active={i === activeIdx}
                  onClick={() => {
                    setActiveIdx(i);
                    setPlaying(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active snapshot detail */}
      {active && (
        <div className="mt-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/60">
          <div className="grid grid-cols-3 gap-2 text-center">
            {active.sbp != null && (
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">SBP</div>
                <div className="text-sm font-bold text-white tabular-nums">{active.sbp.toFixed(0)}</div>
              </div>
            )}
            {active.dbp != null && (
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">DBP</div>
                <div className="text-sm font-bold text-white tabular-nums">{active.dbp.toFixed(0)}</div>
              </div>
            )}
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Score</div>
              <div className="text-sm font-bold font-mono tabular-nums" style={{ color: RISK_COLORS[active.risk_tier as RiskTier] ?? "#94a3b8" }}>
                {active.risk_score.toFixed(3)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replay button */}
      {snapshots.length > 1 && (
        <button
          onClick={playing ? () => setPlaying(false) : startReplay}
          className="mt-3 w-full py-1.5 rounded text-xs font-semibold border border-cyan-600 
                     text-cyan-400 hover:bg-cyan-600/10 transition-colors"
        >
          {playing ? "⏸ Pause replay" : "▶ Replay Digital Twin"}
        </button>
      )}
    </div>
  );
}

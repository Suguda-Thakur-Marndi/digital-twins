"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { fetchPopulation, PopulationPatient } from "@/lib/api";
import { RISK_COLORS, RiskTier } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Users, Filter, Search, ArrowRight, Info, AlertTriangle } from "lucide-react";

export default function PopulationPage() {
  const [data, setData] = useState<PopulationPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAge, setSelectedAge] = useState<string>("");
  const [selectedGender, setSelectedGender] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetchPopulation(
      selectedAge || undefined,
      selectedGender || undefined,
      selectedTier || undefined
    )
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((e) => {
        setError(e.message || "Failed to load population data");
      })
      .finally(() => setLoading(false));
  }, [selectedAge, selectedGender, selectedTier]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(
      (p) =>
        p.patient_id.toLowerCase().includes(q) ||
        (p.gender && p.gender.toLowerCase().includes(q)) ||
        (p.age && String(p.age).includes(q))
    );
  }, [data, searchQuery]);

  const stats = useMemo(() => {
    const total = data.length;
    if (total === 0) {
      return { total: 0, high: 0, med: 0, low: 0, avgRisk: 0, highPct: "0.0", medPct: "0.0", lowPct: "0.0" };
    }
    const high = data.filter((p) => p.risk_tier === "HIGH").length;
    const med = data.filter((p) => p.risk_tier === "MEDIUM").length;
    const low = data.filter((p) => p.risk_tier === "LOW").length;
    const avgRisk = data.reduce((acc, p) => acc + (p.risk_score || 0), 0) / total;
    return {
      total,
      high,
      med,
      low,
      avgRisk,
      highPct: ((high / total) * 100).toFixed(1),
      medPct: ((med / total) * 100).toFixed(1),
      lowPct: ((low / total) * 100).toFixed(1),
    };
  }, [data]);

  const chartData = useMemo(() => {
    return [
      { name: "Low Risk", count: stats.low, tier: "LOW", color: "#16a34a" },
      { name: "Medium Risk", count: stats.med, tier: "MEDIUM", color: "#d97706" },
      { name: "High Risk", count: stats.high, tier: "HIGH", color: "#dc2626" },
    ];
  }, [stats]);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">
              Cohort Analysis
            </span>
            <span className="text-[10px] font-mono bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 px-2 py-0.5 rounded-full font-bold">
              Cohort N=1,335 · Synthea Provenance
            </span>
          </div>
          <h1 className="text-2xl font-editorial font-bold text-[var(--text-primary)]">
            Cohort Risk Stratification &amp; Roster
          </h1>
          <p className="text-xs text-[var(--text-muted)] max-w-xl mt-0.5 leading-relaxed">
            Population-level distribution of 365-day decompensation risk scores across demographic strata.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/patients"
            className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
          >
            <Users className="w-3.5 h-3.5 text-[var(--color-primary)]" />
            <span>Patient Cohort Roster →</span>
          </Link>
        </div>
      </div>

      {/* Disclaimers banner */}
      <div className="p-3 rounded-xl glass-card bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Prototype Demonstration:</strong> Scores reflect Platt-calibrated XGBoost probabilities, not epidemiological prevalence or diagnostic advice.
          </span>
        </div>
        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300 shrink-0 hidden sm:inline">
          Research Prototype
        </span>
      </div>

      {/* Global error */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-800 dark:text-rose-200 text-xs">
          {error.includes("fetch") || error.includes("Failed")
            ? "Population service unavailable. Please check that the FastAPI backend is running on port 8000."
            : error}
        </div>
      )}

      {/* Filters Card */}
      <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Age Band
            </label>
            <select
              value={selectedAge}
              onChange={(e) => setSelectedAge(e.target.value)}
              className="px-2.5 py-1.5 rounded bg-white border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
            >
              <option value="">All Ages</option>
              <option value="18-40">18 - 40 years</option>
              <option value="40-60">40 - 60 years</option>
              <option value="60+">60+ years</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Gender
            </label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="px-2.5 py-1.5 rounded bg-white border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Risk Tier
            </label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="px-2.5 py-1.5 rounded bg-white border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
            >
              <option value="">All Tiers</option>
              <option value="HIGH">High Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="LOW">Low Risk</option>
            </select>
          </div>
        </div>

        <div className="w-full sm:w-auto">
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Search Patient ID
          </label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ID, gender..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded bg-white border border-[var(--border-hairline)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-teal)]"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs">
          <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
            Cohort Sample
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)] tabular-nums">
            {loading ? "..." : stats.total}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Evaluated records</div>
        </div>

        <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs border-l-3 border-l-red-500">
          <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">
            High Risk
          </div>
          <div className="text-2xl font-bold font-mono text-red-600 tabular-nums">
            {loading ? "..." : `${stats.high} (${stats.highPct}%)`}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Calibrated Risk ≥ 40%</div>
        </div>

        <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs border-l-3 border-l-amber-500">
          <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
            Medium Risk
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {loading ? "..." : `${stats.med} (${stats.medPct}%)`}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">15% ≤ Risk &lt; 40%</div>
        </div>

        <div className="clinical-card p-4 bg-white border-[var(--border-hairline)] shadow-2xs border-l-3 border-l-emerald-500">
          <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
            Low Risk
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {loading ? "..." : `${stats.low} (${stats.lowPct}%)`}
          </div>
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Calibrated Risk &lt; 15%</div>
        </div>
      </div>

      {/* Chart + Table Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Chart */}
        <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] shadow-2xs">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
            Risk Tier Breakdown
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#e2e8f0",
                    fontSize: "12px",
                    borderRadius: "6px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border-hairline)] text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>Average cohort score:</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {(stats.avgRisk * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Patient Roster Table */}
        <div className="clinical-card p-5 bg-white border-[var(--border-hairline)] shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Cohort Roster ({filteredPatients.length})
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Profiles ranked by 365-day decompensation risk
              </p>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Displaying up to 100 records
            </span>
          </div>

          <div className="overflow-x-auto flex-1 max-h-[380px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-subtle)]">
                  <th className="py-2.5 px-3">Patient ID</th>
                  <th className="py-2.5 px-3">Age</th>
                  <th className="py-2.5 px-3">Gender</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Risk Tier</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)]">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                      Loading cohort data...
                    </td>
                  </tr>
                ) : filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                      No patients match current filters.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.slice(0, 100).map((pt) => {
                    const tier = (pt.risk_tier as RiskTier) || "LOW";
                    const isHigh = tier === "HIGH";
                    const isMed = tier === "MEDIUM";

                    const badgeClass = isHigh
                      ? "bg-red-50 text-red-700 border-red-200"
                      : isMed
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200";

                    return (
                      <tr
                        key={pt.patient_id}
                        className="hover:bg-[var(--bg-subtle)] transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-xs text-[var(--text-primary)] font-medium">
                          {pt.patient_id}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)] font-mono">
                          {pt.age ? `${Math.round(pt.age)}y` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-secondary)] capitalize">
                          {pt.gender ?? "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold text-[var(--text-primary)]">
                          {(pt.risk_score * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeClass}`}>
                            {pt.risk_tier}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/twin?patient=${pt.patient_id}`}
                            className="inline-flex items-center gap-1 text-[var(--accent-teal)] hover:underline text-xs font-medium"
                          >
                            <span>Inspect Twin</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

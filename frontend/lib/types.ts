/**
 * Shared TypeScript types & clinical design helpers for TwinCare / Pramana Twin.
 */

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "Low" | "Moderate" | "High";

export const RISK_COLORS: Record<RiskTier, string> = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  Low: "#15803d",
  Moderate: "#b45309",
  High: "#be123c",
};

export const RISK_BG: Record<RiskTier, string> = {
  LOW: "bg-green-500/10 border-green-500/30 text-green-400",
  MEDIUM: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  HIGH: "bg-red-500/10 border-red-500/30 text-red-400",
  Low: "bg-emerald-500/10 border-emerald-500/30 text-emerald-700",
  Moderate: "bg-amber-500/10 border-amber-500/30 text-amber-700",
  High: "bg-rose-500/10 border-rose-500/30 text-rose-700",
};

export const RISK_GLOW: Record<RiskTier, string> = {
  LOW: "shadow-green-500/20",
  MEDIUM: "shadow-amber-500/20",
  HIGH: "shadow-red-500/20",
  Low: "shadow-emerald-500/20",
  Moderate: "shadow-amber-500/20",
  High: "shadow-rose-500/20",
};

export const RISK_BADGE_CLASSES: Record<string, string> = {
  Low: "badge-risk-low text-xs px-2.5 py-0.5 rounded font-medium",
  LOW: "badge-risk-low text-xs px-2.5 py-0.5 rounded font-medium",
  Moderate: "badge-risk-mod text-xs px-2.5 py-0.5 rounded font-medium",
  MEDIUM: "badge-risk-mod text-xs px-2.5 py-0.5 rounded font-medium",
  High: "badge-risk-high text-xs px-2.5 py-0.5 rounded font-medium",
  HIGH: "badge-risk-high text-xs px-2.5 py-0.5 rounded font-medium",
};

export function tierLabel(tier: RiskTier | string | null | undefined): string {
  if (!tier) return "—";
  return tier.toUpperCase();
}

export function normalizeTier(tier: string | null | undefined): "Low" | "Moderate" | "High" {
  if (!tier) return "Low";
  const upper = tier.toUpperCase();
  if (upper.includes("HIGH")) return "High";
  if (upper.includes("MED") || upper.includes("MOD")) return "Moderate";
  return "Low";
}

export function formatPercent(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "—";
  return `${(val * 100).toFixed(1)}%`;
}

export function formatScore(score: number | null | undefined): string {
  if (score == null || isNaN(score)) return "—";
  return score.toFixed(4);
}

export function formatVital(
  value: number | null | undefined,
  unit = "",
  decimals = 1
): string {
  if (value == null || isNaN(value)) return "—";
  return `${value.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

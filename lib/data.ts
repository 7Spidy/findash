/**
 * Client-safe utilities: formatting helpers and colour maps.
 * Safe to import from both server and client components.
 */
import type { Category } from "@/types";

export function formatINR(amount: number, compact = false): string {
  if (compact && amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (compact && amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function categoryColor(category: Category): string {
  const map: Record<Category, string> = {
    "Food & Dining":    "#f59e0b",
    "Transport":        "#3b82f6",
    "Shopping":         "#8b5cf6",
    "Entertainment":    "#ec4899",
    "Health & Fitness": "#10b981",
    "Subscriptions":    "#f43f5e",
    "Utilities":        "#6b7280",
    "Transfers":        "#64748b",
    "Others":           "#94a3b8",
  };
  return map[category] ?? "#94a3b8";
}

export function deltaArrow(pct: number): string {
  if (pct > 0) return "↑";
  if (pct < 0) return "↓";
  return "—";
}

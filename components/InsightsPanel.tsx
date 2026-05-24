"use client";

import { motion } from "framer-motion";
import type { InsightsData } from "@/types";
import { formatINR } from "@/lib/data";
import GlassCard from "./GlassCard";
import clsx from "clsx";

interface InsightsPanelProps {
  insights: InsightsData;
}

const ALERT_STYLES = {
  unused_subscription: { bg: "bg-amber-50/80",  border: "border-amber-200", icon: "⚠", color: "text-amber-600" },
  spike:               { bg: "bg-rose-50/80",    border: "border-rose-200",  icon: "↑", color: "text-rose-500"  },
  duplicate:           { bg: "bg-purple-50/80",  border: "border-purple-200",icon: "⊘", color: "text-purple-500"},
  large_single:        { bg: "bg-blue-50/80",    border: "border-blue-200",  icon: "!", color: "text-blue-500"  },
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      <section>
        <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Spend Alerts
        </h3>
        <div className="flex flex-col gap-3">
          {insights.alerts.map((alert, i) => {
            const style = ALERT_STYLES[alert.type] ?? ALERT_STYLES.spike;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className={clsx(
                  "flex gap-4 p-4 rounded-2xl border",
                  style.bg, style.border
                )}
              >
                <div className={clsx("text-xl mt-0.5 flex-shrink-0", style.color)}>
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{alert.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.description}</div>
                  {alert.estimated_saving ? (
                    <div className={clsx("text-xs font-semibold mt-1.5", style.color)}>
                      Potential saving: {formatINR(alert.estimated_saving)}/month
                    </div>
                  ) : null}
                </div>
              </motion.div>
            );
          })}
          {insights.alerts.length === 0 && (
            <p className="text-sm text-gray-400 italic">No alerts this month. Great job!</p>
          )}
        </div>
      </section>

      {/* ── Tips ────────────────────────────────────────────────────────── */}
      <section>
        <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Actionable Tips
        </h3>
        <div className="flex flex-col gap-2.5">
          {insights.tips.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="flex gap-3 p-4 rounded-2xl bg-white/40 border border-white/60"
            >
              <span className="text-sage-400 font-bold text-sm flex-shrink-0">{String(i + 1).padStart(2, "0")}</span>
              <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Subscriptions ──────────────────────────────────────────────── */}
      <section>
        <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
          Detected Subscriptions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.subscriptions.map((sub, i) => (
            <motion.div
              key={sub.name}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-card p-4 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-gray-800">{sub.name}</span>
                <span className="badge bg-sage-50 text-sage-700 text-[11px]">{sub.frequency}</span>
              </div>
              <div className="text-xl font-bold text-gray-800 heading">{formatINR(sub.amount)}</div>
              <div className="text-xs text-gray-400">
                Last charged: {new Date(sub.last_charged).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

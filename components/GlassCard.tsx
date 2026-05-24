"use client";

import { motion } from "framer-motion";
import clsx from "clsx";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  as?: "div" | "section" | "article";
}

export default function GlassCard({
  children,
  className,
  hover = true,
  delay = 0,
  as: Tag = "div",
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={clsx("glass-card p-6", !hover && "hover:transform-none hover:shadow-glass", className)}
    >
      {children}
    </motion.div>
  );
}

// ─── Stat card sub-component ─────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  subColor?: "sage" | "rose" | "amber" | "muted";
  icon?: React.ReactNode;
  delay?: number;
}

export function StatCard({ label, value, sub, subColor = "muted", icon, delay = 0 }: StatCardProps) {
  const subColors = {
    sage:  "text-sage-600",
    rose:  "text-rose-500",
    amber: "text-amber-500",
    muted: "text-gray-400",
  };

  return (
    <GlassCard delay={delay} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</span>
        {icon && <span className="text-gray-300">{icon}</span>}
      </div>
      <div className="heading text-2xl font-bold text-gray-800 animate-count">{value}</div>
      {sub && <div className={clsx("text-xs font-medium", subColors[subColor])}>{sub}</div>}
    </GlassCard>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("glass-card p-6", className)}>
      <div className="skeleton h-3 w-24 mb-3" />
      <div className="skeleton h-7 w-32 mb-2" />
      <div className="skeleton h-3 w-20" />
    </div>
  );
}

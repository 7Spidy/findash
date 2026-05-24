"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from "recharts";
import { formatINR, categoryColor } from "@/lib/data";
import type { Category } from "@/types";

interface SpendSlice {
  category: Category;
  amount: number;
}

interface SpendingDonutProps {
  data: SpendSlice[];
  onCategoryClick?: (category: Category | null) => void;
}

function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="#1a1f2e" className="heading" fontSize={15} fontWeight={700}>
        {payload.category.split(" ")[0]}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize={13}>
        {formatINR(value)}
      </text>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={outerRadius + 12}
        outerRadius={outerRadius + 16}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.4}
      />
    </g>
  );
}

export default function SpendingDonut({ data, onCategoryClick }: SpendingDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = data.reduce((s, d) => s + d.amount, 0);
  const sorted = [...data].sort((a, b) => b.amount - a.amount);

  const handleClick = (index: number) => {
    const next = activeIndex === index ? null : index;
    setActiveIndex(next);
    onCategoryClick?.(next !== null ? sorted[next].category : null);
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      {/* Donut */}
      <div className="flex-shrink-0">
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Pie
              data={sorted}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              activeIndex={activeIndex ?? undefined}
              activeShape={<ActiveShape />}
              onClick={(_, index) => handleClick(index)}
              style={{ cursor: "pointer" }}
            >
              {sorted.map((entry) => (
                <Cell key={entry.category} fill={categoryColor(entry.category)} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [formatINR(v), ""]}
              contentStyle={{ fontFamily: "DM Sans" }}
            />
            {activeIndex === null && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="#1a1f2e" fontSize={14} fontWeight={600} fontFamily="Sora">
                Total
              </text>
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex-1 grid grid-cols-1 gap-1.5 w-full">
        {sorted.map((entry, i) => {
          const pct = total > 0 ? ((entry.amount / total) * 100).toFixed(1) : "0";
          const isActive = activeIndex === i;
          return (
            <button
              key={entry.category}
              onClick={() => handleClick(i)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all
                ${isActive ? "bg-white/60 shadow-card-sm" : "hover:bg-white/40"}`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: categoryColor(entry.category) }}
              />
              <span className="text-sm text-gray-700 flex-1 truncate">{entry.category}</span>
              <span className="text-xs text-gray-400">{pct}%</span>
              <span className="text-sm font-semibold text-gray-700">{formatINR(entry.amount, true)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

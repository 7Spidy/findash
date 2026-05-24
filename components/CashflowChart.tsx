"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MonthlyFlow } from "@/types";
import { formatINR } from "@/lib/data";

interface CashflowChartProps {
  data: MonthlyFlow[];
  title?: string;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleString("en-IN", { month: "short" });
}

export default function CashflowChart({ data, title }: CashflowChartProps) {
  const chartData = data.map((d) => ({
    month: monthLabel(d.month),
    "Money In": d.credit,
    "Money Out": d.debit,
  }));

  return (
    <div className="w-full">
      {title && (
        <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#94a3b8", fontFamily: "DM Sans" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatINR(v, true)}
            tick={{ fontSize: 11, fill: "#94a3b8", fontFamily: "DM Sans" }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatINR(value), name]}
            cursor={{ fill: "rgba(63,130,96,0.05)" }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, fontFamily: "DM Sans", paddingTop: 8 }}
          />
          <Bar dataKey="Money In" fill="#63a07f" radius={[6, 6, 0, 0]} maxBarSize={40} />
          <Bar dataKey="Money Out" fill="#fda4af" radius={[6, 6, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

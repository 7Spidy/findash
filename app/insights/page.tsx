import { getInsightsData, getTransactions, getLastUpdated } from "@/lib/server-data";
import { formatINR, categoryColor } from "@/lib/data";
import DashboardShell from "@/components/DashboardShell";
import GlassCard from "@/components/GlassCard";
import InsightsPanel from "@/components/InsightsPanel";
import SpendingDonut from "@/components/SpendingDonut";
import type { Category } from "@/types";

export const revalidate = 300;

export default function InsightsPage() {
  const insights     = getInsightsData();
  const transactions = getTransactions();
  const lastUpdated  = getLastUpdated();

  const thisMonth = new Date().toISOString().slice(0, 7);

  const buildCatData = (month: string) => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "debit" && t.date.startsWith(month))
      .forEach((t) => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map)
      .map(([cat, amt]) => ({ category: cat as Category, amount: Math.round(amt) }))
      .sort((a, b) => b.amount - a.amount);
  };

  const thisMonthCats = buildCatData(thisMonth);
  const totalThisMonth = thisMonthCats.reduce((s, c) => s + c.amount, 0);
  const avgDaily = Math.round(totalThisMonth / new Date().getDate());
  const subTotal = insights.subscriptions.reduce((s, sub) => s + sub.amount, 0);

  return (
    <DashboardShell lastUpdated={lastUpdated.timestamp}>
      <div className="mb-8">
        <h1 className="heading text-3xl font-bold text-gray-800 tracking-tight">Spending Insights</h1>
        <p className="text-gray-400 mt-1 text-sm">
          AI-powered analysis · Generated {new Date(insights.generated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <GlassCard delay={0} className="col-span-2 lg:col-span-1 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Total Spend (MTD)</span>
          <span className="heading text-2xl font-bold text-gray-800">{formatINR(totalThisMonth, true)}</span>
          <span className="text-xs text-gray-400">Avg {formatINR(avgDaily, true)}/day</span>
        </GlassCard>
        <GlassCard delay={0.06} className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Categories Active</span>
          <span className="heading text-2xl font-bold text-gray-800">{thisMonthCats.length}</span>
        </GlassCard>
        <GlassCard delay={0.12} className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Subscriptions</span>
          <span className="heading text-2xl font-bold text-gray-800">{insights.subscriptions.length}</span>
          <span className="text-xs text-amber-500 font-medium">{formatINR(subTotal, true)}/month</span>
        </GlassCard>
        <GlassCard delay={0.18} className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Alerts</span>
          <span className="heading text-2xl font-bold text-gray-800">{insights.alerts.length}</span>
          <span className="text-xs text-rose-400 font-medium">
            {insights.alerts.filter(a => a.type === "spike").length} spending spikes
          </span>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <GlassCard delay={0.24}>
          <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            This Month — Combined Spending
          </h3>
          {thisMonthCats.length > 0
            ? <SpendingDonut data={thisMonthCats} />
            : <p className="text-gray-400 text-sm">No data yet this month.</p>}
        </GlassCard>

        <GlassCard delay={0.30}>
          <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Category Trends</h3>
          <div className="flex flex-col gap-2">
            {insights.category_insights
              .filter(c => c.this_month > 0 || c.last_month > 0)
              .sort((a, b) => b.this_month - a.this_month)
              .slice(0, 8)
              .map((cat) => {
                const maxAmt = Math.max(cat.this_month, cat.last_month, 1);
                const isUp = cat.change_pct > 0;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: categoryColor(cat.category as Category) }} />
                    <span className="text-xs text-gray-600 w-32 flex-shrink-0 truncate">{cat.category}</span>
                    <div className="flex-1 flex gap-1 items-center">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-300 rounded-full" style={{ width: `${(cat.last_month / maxAmt) * 100}%` }} />
                      </div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(cat.this_month / maxAmt) * 100}%`, background: categoryColor(cat.category as Category) }} />
                      </div>
                    </div>
                    <span className={`text-xs font-semibold w-12 text-right ${isUp ? "text-rose-400" : "text-sage-500"}`}>
                      {isUp ? "↑" : "↓"}{Math.abs(cat.change_pct)}%
                    </span>
                    <span className="text-xs text-gray-500 w-16 text-right">{formatINR(cat.this_month, true)}</span>
                  </div>
                );
              })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-gray-300 rounded-full inline-block" /> Last month</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 bg-sage-400 rounded-full inline-block" /> This month</span>
          </div>
        </GlassCard>
      </div>

      <GlassCard delay={0.36} className="mb-8">
        <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Top Merchants — All Time</h3>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="bg-white/20">
                <th>#</th><th>Merchant</th>
                <th className="text-right">Total Spent</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">Avg per Txn</th>
              </tr>
            </thead>
            <tbody>
              {insights.top_merchants.map((m, i) => (
                <tr key={m.merchant}>
                  <td className="text-gray-300 font-semibold">{String(i + 1).padStart(2, "0")}</td>
                  <td className="font-medium text-gray-800">{m.merchant}</td>
                  <td className="text-right font-semibold text-gray-800">{formatINR(m.total)}</td>
                  <td className="text-right text-gray-500">{m.count}</td>
                  <td className="text-right text-gray-400">{formatINR(Math.round(m.total / m.count))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard delay={0.42} hover={false}>
        <InsightsPanel insights={insights} />
      </GlassCard>
    </DashboardShell>
  );
}


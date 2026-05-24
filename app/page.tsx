import { getAccountsData, getCreditCardsData, getInsightsData, getLastUpdated, getTransactions } from "@/lib/server-data";
import { formatINR, deltaArrow, buildMonthlyFlow } from "@/lib/data";
import DashboardShell from "@/components/DashboardShell";
import GlassCard, { StatCard } from "@/components/GlassCard";
import CashflowChart from "@/components/CashflowChart";
import SpendingDonut from "@/components/SpendingDonut";
import TransactionTable from "@/components/TransactionTable";
import type { Category } from "@/types";

export const revalidate = 300;

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function OverviewPage() {
  const accounts    = getAccountsData();
  const cards       = getCreditCardsData();
  const insights    = getInsightsData();
  const lastUpdated = getLastUpdated();
  const transactions = getTransactions();

  const totalBalance = accounts.accounts.reduce((s, a) => s + a.balance, 0);
  const totalCCSpend = cards.cards.reduce((s, c) => s + c.this_cycle_spend, 0);

  // Derive MTD and last-month totals from transactions (pipeline only writes transactions.json)
  const thisMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const totalIn      = transactions.filter(t => t.type === "credit" && t.date.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);
  const totalOut     = transactions.filter(t => t.type === "debit"  && t.date.startsWith(thisMonth)).reduce((s, t) => s + t.amount, 0);
  const totalLastIn  = transactions.filter(t => t.type === "credit" && t.date.startsWith(lastMonth)).reduce((s, t) => s + t.amount, 0);
  const totalLastOut = transactions.filter(t => t.type === "debit"  && t.date.startsWith(lastMonth)).reduce((s, t) => s + t.amount, 0);

  const inDelta  = totalLastIn  > 0 ? ((totalIn  - totalLastIn)  / totalLastIn  * 100) : 0;
  const outDelta = totalLastOut > 0 ? ((totalOut - totalLastOut) / totalLastOut * 100) : 0;

  // Cashflow chart — aggregate HDFC transactions by month
  const primaryFlow = buildMonthlyFlow(transactions.filter(t => t.account === "HDFC"));
  const categoryMap: Record<string, number> = {};
  transactions
    .filter((t) => t.type === "debit" && t.date.startsWith(thisMonth))
    .forEach((t) => { categoryMap[t.category] = (categoryMap[t.category] ?? 0) + t.amount; });
  const categoryData = Object.entries(categoryMap)
    .map(([cat, amt]) => ({ category: cat as Category, amount: Math.round(amt) }))
    .sort((a, b) => b.amount - a.amount);

  const recentTxns = transactions.slice(0, 8);

  return (
    <DashboardShell lastUpdated={lastUpdated.timestamp}>
      <div className="mb-8">
        <h1 className="heading text-3xl font-bold text-gray-800 tracking-tight">
          Good {getTimeOfDay()}, Avi
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Financial overview for{" "}
          {new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Balance"    value={formatINR(totalBalance, true)} sub="Across HDFC + ICICI" subColor="muted" delay={0} />
        <StatCard label="Money In (MTD)"   value={formatINR(totalIn, true)}
          sub={`${deltaArrow(inDelta)} ${Math.abs(inDelta).toFixed(1)}% vs last month`}
          subColor={inDelta >= 0 ? "sage" : "rose"} delay={0.06} />
        <StatCard label="Money Out (MTD)"  value={formatINR(totalOut, true)}
          sub={`${deltaArrow(outDelta)} ${Math.abs(outDelta).toFixed(1)}% vs last month`}
          subColor={outDelta <= 0 ? "sage" : "rose"} delay={0.12} />
        <StatCard label="CC Spend (Cycle)" value={formatINR(totalCCSpend, true)}
          sub={`${cards.cards.length} cards active`} subColor="amber" delay={0.18} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <GlassCard delay={0.24}>
          <CashflowChart data={primaryFlow} title="HDFC Cashflow (6 months)" />
        </GlassCard>
        <GlassCard delay={0.30}>
          <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Spend by Category — This Month
          </h3>
          {categoryData.length > 0
            ? <SpendingDonut data={categoryData} />
            : <p className="text-gray-400 text-sm">No spend data yet this month.</p>}
        </GlassCard>
      </div>

      {insights.alerts.length > 0 && (
        <GlassCard delay={0.36} className="mb-8">
          <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            AI Spend Alerts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.alerts.slice(0, 3).map((alert, i) => (
              <div key={i} className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="font-semibold text-sm text-gray-800 mb-1">{alert.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">{alert.description}</div>
                {alert.estimated_saving ? (
                  <div className="text-xs font-semibold text-amber-600 mt-2">
                    Save {formatINR(alert.estimated_saving)}/mo
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard delay={0.42} hover={false}>
        <TransactionTable transactions={recentTxns} title="Recent Transactions" showSearch={false} showFilters={false} />
        <div className="mt-4 text-center">
          <a href="/transactions" className="text-sm text-sage-600 font-semibold hover:text-sage-700">
            View all transactions →
          </a>
        </div>
      </GlassCard>
    </DashboardShell>
  );
}


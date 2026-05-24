import { getCreditCardsData, getTransactions, getLastUpdated } from "@/lib/server-data";
import { formatINR } from "@/lib/data";
import DashboardShell from "@/components/DashboardShell";
import GlassCard, { StatCard } from "@/components/GlassCard";
import CashflowChart from "@/components/CashflowChart";
import TransactionTable from "@/components/TransactionTable";
import SpendingDonut from "@/components/SpendingDonut";
import type { Category } from "@/types";

export const revalidate = 300;

export default function CreditCardsPage() {
  const cards        = getCreditCardsData();
  const transactions = getTransactions();
  const lastUpdated  = getLastUpdated();

  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <DashboardShell lastUpdated={lastUpdated.timestamp}>
      <div className="mb-8">
        <h1 className="heading text-3xl font-bold text-gray-800 tracking-tight">Credit Cards</h1>
        <p className="text-gray-400 mt-1 text-sm">SBI SimplyCLICK and ICICI Amazon Pay</p>
      </div>

      {cards.cards.map((card, cardIdx) => {
        const cardTxns = transactions.filter((t) => t.account === card.id);
        const daysUntilDue = Math.ceil((new Date(card.due_date).getTime() - Date.now()) / 86400000);
        const dueUrgency = daysUntilDue <= 3 ? "rose" : daysUntilDue <= 7 ? "amber" : "sage";
        const cycleChange = card.last_cycle_spend > 0
          ? ((card.this_cycle_spend / card.last_cycle_spend - 1) * 100)
          : 0;

        const catMap: Record<string, number> = {};
        cardTxns
          .filter((t) => t.type === "debit" && t.date.startsWith(thisMonth))
          .forEach((t) => { catMap[t.category] = (catMap[t.category] ?? 0) + t.amount; });
        const categoryData = Object.entries(catMap)
          .map(([cat, amt]) => ({ category: cat as Category, amount: Math.round(amt) }))
          .sort((a, b) => b.amount - a.amount);

        return (
          <section key={card.id} className="mb-12">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {card.bank[0]}
              </div>
              <div>
                <h2 className="heading text-xl font-bold text-gray-800">{card.name}</h2>
                <div className="text-xs text-gray-400">{card.bank} · Limit {formatINR(card.credit_limit, true)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="This Cycle Spend" value={formatINR(card.this_cycle_spend, true)}
                sub={`${cycleChange >= 0 ? "↑" : "↓"} ${Math.abs(cycleChange).toFixed(1)}% vs last`}
                subColor={card.this_cycle_spend <= card.last_cycle_spend ? "sage" : "rose"} delay={cardIdx * 0.12} />
              <StatCard label="Total Due" value={formatINR(card.total_due, true)}
                sub={`Min due: ${formatINR(card.minimum_due, true)}`} subColor="amber" delay={cardIdx * 0.12 + 0.06} />
              <StatCard label="Days Until Due" value={daysUntilDue <= 0 ? "Overdue!" : `${daysUntilDue} days`}
                sub={new Date(card.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                subColor={dueUrgency} delay={cardIdx * 0.12 + 0.12} />
              <StatCard label="Utilisation" value={`${card.utilization_pct}%`}
                sub={`${formatINR(card.outstanding, true)} of ${formatINR(card.credit_limit, true)}`}
                subColor={card.utilization_pct > 70 ? "rose" : card.utilization_pct > 40 ? "amber" : "sage"}
                delay={cardIdx * 0.12 + 0.18} />
            </div>

            <GlassCard delay={cardIdx * 0.12 + 0.22} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Credit Utilisation</span>
                <span className={`text-sm font-bold ${card.utilization_pct > 70 ? "text-rose-500" : card.utilization_pct > 40 ? "text-amber-500" : "text-sage-600"}`}>
                  {card.utilization_pct}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${card.utilization_pct > 70 ? "bg-rose-400" : card.utilization_pct > 40 ? "bg-amber-400" : "bg-sage-400"}`}
                  style={{ width: `${Math.min(card.utilization_pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>₹0</span><span>{formatINR(card.credit_limit, true)}</span>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <GlassCard delay={cardIdx * 0.12 + 0.28}>
                <CashflowChart data={card.monthly_spend} title="Monthly Spend Trend" />
              </GlassCard>
              <GlassCard delay={cardIdx * 0.12 + 0.34}>
                <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">Category Breakdown</h3>
                {categoryData.length > 0
                  ? <SpendingDonut data={categoryData} />
                  : <p className="text-gray-400 text-sm">No spend this cycle.</p>}
              </GlassCard>
            </div>

            <GlassCard delay={cardIdx * 0.12 + 0.40} hover={false}>
              <TransactionTable transactions={cardTxns} title={`${card.bank} CC Transactions`} maxRows={20} showSearch showFilters />
            </GlassCard>
          </section>
        );
      })}
    </DashboardShell>
  );
}


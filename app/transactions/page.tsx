import { getTransactions, getLastUpdated } from "@/lib/server-data";
import { formatINR } from "@/lib/data";
import DashboardShell from "@/components/DashboardShell";
import GlassCard from "@/components/GlassCard";
import TransactionTable from "@/components/TransactionTable";

export const revalidate = 300;

const THRESHOLD_BANK = 10000;
const THRESHOLD_CC   = 5000;

export default function TransactionsPage() {
  const transactions = getTransactions();
  const lastUpdated  = getLastUpdated();

  const bankAccounts = new Set(["HDFC", "ICICI"]);

  const largeCredits = [...transactions]
    .filter((t) => t.type === "credit" && t.amount >= THRESHOLD_BANK)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const largeDebits = [...transactions]
    .filter((t) => {
      if (t.type !== "debit") return false;
      return t.amount >= (bankAccounts.has(t.account) ? THRESHOLD_BANK : THRESHOLD_CC);
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return (
    <DashboardShell lastUpdated={lastUpdated.timestamp}>
      <div className="mb-8">
        <h1 className="heading text-3xl font-bold text-gray-800 tracking-tight">Transactions</h1>
        <p className="text-gray-400 mt-1 text-sm">{transactions.length} transactions · Last 90 days</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <GlassCard delay={0} hover={false}>
          <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Large Credits (≥ {formatINR(THRESHOLD_BANK, true)})
          </h3>
          <div className="flex flex-col gap-2">
            {largeCredits.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/30 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{t.merchant}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t.account}
                  </div>
                </div>
                <div className="text-sage-600 font-bold">+{formatINR(t.amount, true)}</div>
              </div>
            ))}
            {largeCredits.length === 0 && <p className="text-gray-400 text-sm">No large credits.</p>}
          </div>
        </GlassCard>

        <GlassCard delay={0.08} hover={false}>
          <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest mb-4">
            Large Debits (≥ {formatINR(THRESHOLD_CC, true)})
          </h3>
          <div className="flex flex-col gap-2">
            {largeDebits.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/30 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-800">{t.merchant}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {t.account.replace("_CC", " CC")}
                  </div>
                </div>
                <div className="text-rose-500 font-bold">−{formatINR(t.amount, true)}</div>
              </div>
            ))}
            {largeDebits.length === 0 && <p className="text-gray-400 text-sm">No large debits.</p>}
          </div>
        </GlassCard>
      </div>

      <GlassCard delay={0.16} hover={false}>
        <TransactionTable transactions={transactions} title="All Transactions" showSearch showFilters />
      </GlassCard>
    </DashboardShell>
  );
}


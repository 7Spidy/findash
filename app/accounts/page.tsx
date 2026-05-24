import { getAccountsData, getTransactions, getLastUpdated } from "@/lib/server-data";
import { formatINR } from "@/lib/data";
import DashboardShell from "@/components/DashboardShell";
import GlassCard, { StatCard } from "@/components/GlassCard";
import CashflowChart from "@/components/CashflowChart";
import TransactionTable from "@/components/TransactionTable";

export const revalidate = 300;

export default function AccountsPage() {
  const accounts     = getAccountsData();
  const transactions = getTransactions();
  const lastUpdated  = getLastUpdated();

  return (
    <DashboardShell lastUpdated={lastUpdated.timestamp}>
      <div className="mb-8">
        <h1 className="heading text-3xl font-bold text-gray-800 tracking-tight">Accounts</h1>
        <p className="text-gray-400 mt-1 text-sm">HDFC and ICICI savings accounts</p>
      </div>

      {accounts.accounts.map((acct, acctIdx) => {
        const acctTxns = transactions.filter((t) => t.account === acct.id);
        const inDelta  = acct.last_month_credit > 0 ? ((acct.this_month_credit - acct.last_month_credit) / acct.last_month_credit * 100) : 0;
        const outDelta = acct.last_month_debit  > 0 ? ((acct.this_month_debit  - acct.last_month_debit)  / acct.last_month_debit  * 100) : 0;
        const net = acct.this_month_credit - acct.this_month_debit;

        return (
          <section key={acct.id} className="mb-12">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sage-400 to-sage-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {acct.id[0]}
              </div>
              <div>
                <h2 className="heading text-xl font-bold text-gray-800">{acct.name}</h2>
                <div className="text-xs text-gray-400">As of {new Date(acct.as_of).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="heading text-2xl font-bold text-gray-800">{formatINR(acct.balance)}</div>
                <div className="text-xs text-gray-400">Current balance</div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <StatCard label="In This Month"  value={formatINR(acct.this_month_credit, true)}
                sub={`${inDelta >= 0 ? "↑" : "↓"} ${Math.abs(inDelta).toFixed(1)}% vs last`}
                subColor={inDelta >= 0 ? "sage" : "rose"} delay={acctIdx * 0.1} />
              <StatCard label="Out This Month" value={formatINR(acct.this_month_debit, true)}
                sub={`${outDelta >= 0 ? "↑" : "↓"} ${Math.abs(outDelta).toFixed(1)}% vs last`}
                subColor={outDelta <= 0 ? "sage" : "rose"} delay={acctIdx * 0.1 + 0.06} />
              <StatCard label="Net Cashflow" value={formatINR(Math.abs(net), true)}
                sub={net >= 0 ? "Net positive" : "Net negative"}
                subColor={net >= 0 ? "sage" : "rose"} delay={acctIdx * 0.1 + 0.12} />
              <StatCard label="Transactions" value={String(acctTxns.length)}
                sub="Last 90 days" subColor="muted" delay={acctIdx * 0.1 + 0.18} />
            </div>

            <GlassCard delay={acctIdx * 0.1 + 0.24} className="mb-6">
              <CashflowChart data={acct.monthly_flow} title="Monthly Cashflow" />
            </GlassCard>

            <GlassCard delay={acctIdx * 0.1 + 0.30} hover={false}>
              <TransactionTable transactions={acctTxns} title={`${acct.id} Transactions`} maxRows={15} showSearch showFilters />
            </GlassCard>
          </section>
        );
      })}
    </DashboardShell>
  );
}


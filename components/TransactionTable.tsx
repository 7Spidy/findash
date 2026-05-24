"use client";

import { useState, useMemo } from "react";
import clsx from "clsx";
import type { Transaction, Category } from "@/types";
import { formatINR, formatDate, categoryColor } from "@/lib/data";

type SortKey = "date" | "amount" | "merchant" | "category";

interface TransactionTableProps {
  transactions: Transaction[];
  filterCategory?: Category | null;
  title?: string;
  maxRows?: number;
  showSearch?: boolean;
  showFilters?: boolean;
}

export default function TransactionTable({
  transactions,
  filterCategory,
  title,
  maxRows,
  showSearch = true,
  showFilters = false,
}: TransactionTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [typeFilter, setTypeFilter] = useState<"all" | "credit" | "debit">("all");

  const filtered = useMemo(() => {
    let rows = [...transactions];

    if (filterCategory) rows = rows.filter((t) => t.category === filterCategory);
    if (typeFilter !== "all") rows = rows.filter((t) => t.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.account.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date") cmp = a.date.localeCompare(b.date);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "merchant") cmp = a.merchant.localeCompare(b.merchant);
      else if (sortKey === "category") cmp = a.category.localeCompare(b.category);
      return sortAsc ? cmp : -cmp;
    });

    return maxRows ? rows.slice(0, maxRows) : rows;
  }, [transactions, filterCategory, search, sortKey, sortAsc, typeFilter, maxRows]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? <span className="ml-1 opacity-60">{sortAsc ? "↑" : "↓"}</span>
      : <span className="ml-1 opacity-20">↕</span>;

  return (
    <div className="flex flex-col gap-4">
      {(title || showSearch) && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {title && <h3 className="heading text-sm font-semibold text-gray-500 uppercase tracking-widest">{title}</h3>}
          {showSearch && (
            <div className="flex-1 sm:max-w-xs ml-auto">
              <input
                type="search"
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 text-sm rounded-xl border border-white/60 bg-white/50
                           backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-sage-300
                           placeholder:text-gray-300"
              />
            </div>
          )}
        </div>
      )}

      {showFilters && (
        <div className="flex gap-2">
          {(["all", "credit", "debit"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={clsx(
                "px-3 py-1.5 text-xs font-semibold rounded-full transition-all",
                typeFilter === f
                  ? f === "credit" ? "bg-sage-100 text-sage-700" : f === "debit" ? "bg-rose-100 text-rose-600" : "bg-gray-100 text-gray-600"
                  : "bg-white/40 text-gray-400 hover:bg-white/70"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} transactions</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/30">
        <table className="data-table w-full">
          <thead>
            <tr className="bg-white/20">
              <th onClick={() => toggleSort("date")}>Date<SortIcon k="date" /></th>
              <th onClick={() => toggleSort("merchant")}>Merchant<SortIcon k="merchant" /></th>
              <th onClick={() => toggleSort("category")}>Category<SortIcon k="category" /></th>
              <th className="text-right" onClick={() => toggleSort("amount")}>Amount<SortIcon k="amount" /></th>
              <th>Type</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td className="text-gray-500 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td>
                    <div className="font-medium text-gray-800">{t.merchant}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[200px]">{t.description}</div>
                  </td>
                  <td>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        background: categoryColor(t.category) + "18",
                        color: categoryColor(t.category),
                      }}
                    >
                      {t.category}
                    </span>
                  </td>
                  <td className={clsx(
                    "text-right font-semibold whitespace-nowrap",
                    t.type === "credit" ? "text-sage-600" : "text-rose-500"
                  )}>
                    {t.type === "credit" ? "+" : "−"}{formatINR(t.amount)}
                  </td>
                  <td>
                    <span className={clsx("badge", t.type === "credit" ? "badge-credit" : "badge-debit")}>
                      {t.type === "credit" ? "Credit" : "Debit"}
                    </span>
                  </td>
                  <td className="text-xs text-gray-400 whitespace-nowrap">{t.account.replace("_CC", " CC")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

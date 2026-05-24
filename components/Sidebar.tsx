"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/",               label: "Overview",      icon: "▦" },
  { href: "/accounts",       label: "Accounts",      icon: "🏦" },
  { href: "/credit-cards",   label: "Credit Cards",  icon: "💳" },
  { href: "/insights",       label: "Insights",      icon: "✦" },
  { href: "/transactions",   label: "Transactions",  icon: "↕" },
];

interface SidebarProps {
  lastUpdated?: string;
}

export default function Sidebar({ lastUpdated }: SidebarProps) {
  const path = usePathname();

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : null;
  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  return (
    <>
      {/* ── Desktop sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar hidden lg:flex flex-col w-60 min-h-dvh fixed left-0 top-0 z-40 p-5 gap-2">
        {/* Logo */}
        <div className="mb-6 px-2">
          <span className="heading text-xl font-bold text-gray-800 tracking-tight">Fin<span className="text-sage-500">Dash</span></span>
          {lastUpdated && (
            <div className="mt-1 text-[11px] text-gray-400 leading-tight">
              Updated {formattedDate} at {formattedTime}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx("nav-item", path === href && "active")}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="pt-4 border-t border-white/40">
          <form action="/api/logout" method="POST">
            <button
              type="submit"
              className="nav-item w-full text-left text-rose-400 hover:text-rose-600 hover:bg-rose-50"
            >
              <span className="text-base w-5 text-center">⏻</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ──────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-center
                      bg-white/70 backdrop-blur-xl border-t border-white/80 px-2 py-2 safe-bottom">
        {NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all text-xs",
              path === href ? "text-sage-600 font-semibold" : "text-gray-400"
            )}
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="leading-none">{label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

"use client";

import RainCanvas from "./RainCanvas";
import Sidebar from "./Sidebar";

interface DashboardShellProps {
  children: React.ReactNode;
  lastUpdated?: string;
}

export default function DashboardShell({ children, lastUpdated }: DashboardShellProps) {
  return (
    <div className="min-h-dvh relative">
      <RainCanvas />
      <Sidebar lastUpdated={lastUpdated} />

      {/* Main content — offset by sidebar width on desktop */}
      <main className="relative z-10 lg:ml-60 min-h-dvh pb-24 lg:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

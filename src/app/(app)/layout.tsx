import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";

// The terminal: shared live data + paper account for /dashboard, /signals, /backtest and /portfolio.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}

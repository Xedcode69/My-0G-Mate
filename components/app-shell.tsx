"use client";

import { Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { CompanionDashboard } from "@/components/companion-dashboard";
import { StarterPage } from "@/components/starter-page";

export function AppShell() {
  const { authenticated, ready } = usePrivy();

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center text-ink">
        <Loader2 className="h-7 w-7 animate-spin" />
      </main>
    );
  }

  return authenticated ? <CompanionDashboard /> : <StarterPage />;
}

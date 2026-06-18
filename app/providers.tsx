"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

export function Providers({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#d45f3c",
          logo: undefined
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets"
        }
      }}
    >
      {children}
    </PrivyProvider>
  );
}

import { http, createConfig } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "missing-walletconnect-project-id";

export const walletConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [
    injected({ target: "metaMask" }),
    walletConnect({
      projectId,
      metadata: {
        name: "MyMate",
        description: "Persistent AI companions with decentralized memory snapshots.",
        url: "https://mymate.local",
        icons: ["https://mymate.local/icon.png"]
      }
    })
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_BLOCKCHAIN_RPC_URL),
    [mainnet.id]: http()
  },
  ssr: true
});

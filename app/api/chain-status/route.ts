import { JsonRpcProvider } from "ethers";

export async function GET() {
  const registryAddress = process.env.NEXT_PUBLIC_COMPANION_REGISTRY_ADDRESS;
  const chainId = process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID || process.env.NEXT_PUBLIC_BLOCKCHAIN_CHAIN_ID;
  const rpcUrl = process.env.ZERO_G_EVM_RPC || process.env.BLOCKCHAIN_RPC_URL;
  const storageConfigured = Boolean((process.env.ZERO_G_INDEXER_RPC || process.env.ZERO_G_STORAGE_RPC) && process.env.ZERO_G_STORAGE_PRIVATE_KEY && (process.env.ZERO_G_STORAGE_ENCRYPTION_KEY || process.env.MEMORY_ENCRYPTION_KEY));
  const archiveWorkerConfigured = Boolean(process.env.CRON_SECRET);
  let registryStatus: "READY" | "NOT_DEPLOYED" | "UNREACHABLE" | "NOT_CONFIGURED" = "NOT_CONFIGURED";

  if (registryAddress && rpcUrl) {
    try {
      const code = await new JsonRpcProvider(rpcUrl).getCode(registryAddress);
      registryStatus = code === "0x" ? "NOT_DEPLOYED" : "READY";
    } catch {
      registryStatus = "UNREACHABLE";
    }
  }

  return Response.json({
    chainId: chainId ?? null,
    registryConfigured: Boolean(registryAddress && chainId),
    registryStatus,
    storageConfigured,
    archiveWorkerConfigured
  });
}

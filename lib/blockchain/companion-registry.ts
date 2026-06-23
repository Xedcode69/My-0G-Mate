import { BrowserProvider, Contract, Interface } from "ethers";

const abi = [
  "event CompanionCreated(uint256 indexed companionId, address indexed owner, string companionType, uint256 createdAt)",
  "event CompanionArchiveUpdated(uint256 indexed companionId, string rootHash, uint64 archiveVersion)",
  "function createCompanion(string companionType) returns (uint256 companionId)",
  "function updateArchive(uint256 companionId, string rootHash, uint64 archiveVersion)",
  "function ownerOfCompanion(uint256 companionId) view returns (address)"
];

const registryInterface = new Interface(abi);

export function companionRegistryConfig() {
  const address = process.env.NEXT_PUBLIC_COMPANION_REGISTRY_ADDRESS;
  const chainId = Number(process.env.NEXT_PUBLIC_ZERO_G_CHAIN_ID || process.env.NEXT_PUBLIC_BLOCKCHAIN_CHAIN_ID || process.env.NEXT_PUBLIC_CHAIN_ID);
  if (!address || !chainId) return null;
  return { address, chainId };
}

export async function registerCompanionOnchain(eip1193Provider: unknown, companionType: string) {
  const config = companionRegistryConfig();
  if (!config) throw new Error("0G registry is not configured");
  const provider = new BrowserProvider(eip1193Provider as any);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) throw new Error(`Switch your wallet to 0G mainnet (chain ${config.chainId}) before registering this companion`);
  const signer = await provider.getSigner();
  const contract = new Contract(config.address, abi, signer);
  const transaction = await contract.createCompanion(companionType);
  const receipt = await transaction.wait();
  for (const log of receipt.logs) {
    try {
      const event = registryInterface.parseLog(log);
      if (event?.name === "CompanionCreated") return { transactionHash: transaction.hash, companionId: event.args.companionId.toString() };
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error("Companion registration transaction completed without a registry event");
}

export async function updateCompanionArchiveOnchain(eip1193Provider: unknown, companionId: string, rootHash: string, archiveVersion: number) {
  const config = companionRegistryConfig();
  if (!config) throw new Error("0G registry is not configured");
  const provider = new BrowserProvider(eip1193Provider as any);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== config.chainId) throw new Error(`Switch your wallet to 0G mainnet (chain ${config.chainId}) before updating the archive`);
  const contract = new Contract(config.address, abi, await provider.getSigner());
  const transaction = await contract.updateArchive(companionId, rootHash, archiveVersion);
  await transaction.wait();
  return { transactionHash: transaction.hash };
}

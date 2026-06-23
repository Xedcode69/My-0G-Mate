import crypto from "node:crypto";
import { ethers } from "ethers";

type UploadResult = {
  rootHash: string;
  txHash?: string;
  provider: "0g" | "local";
};

type ZeroGUploadTx =
  | { rootHash: string; txHash?: string }
  | { rootHashes: string[]; txHashes?: string[] };

export async function uploadEncryptedSnapshot(encryptedPayload: string): Promise<UploadResult> {
  const rpcUrl = process.env.ZERO_G_EVM_RPC || process.env.BLOCKCHAIN_RPC_URL;
  const indexerRpc = process.env.ZERO_G_INDEXER_RPC || process.env.ZERO_G_STORAGE_RPC;
  const privateKey = process.env.ZERO_G_STORAGE_PRIVATE_KEY;
  const archiveEncryptionKey = getArchiveEncryptionKey();

  if (!rpcUrl || !indexerRpc || !privateKey || !archiveEncryptionKey) {
    return {
      rootHash: `local-${crypto.createHash("sha256").update(encryptedPayload).digest("hex")}`,
      provider: "local"
    };
  }

  const { Indexer, MemData } = await import("@0gfoundation/0g-ts-sdk");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const bytes = Buffer.from(encryptedPayload, "utf8");
  const data = new MemData(bytes);

  const [, treeErr] = await data.merkleTree();
  if (treeErr !== null) throw new Error(`0G merkle tree error: ${treeErr}`);

  const indexer = new Indexer(indexerRpc);
  // MyMate encrypts the archive before upload with a per-user/per-companion
  // derived key. The current 0G SDK then submits those already-encrypted bytes
  // using its supported default transaction flow.
  const [tx, uploadErr] = await indexer.upload(data, rpcUrl, signer as any);
  if (uploadErr !== null) throw new Error(`0G upload error: ${uploadErr}`);

  const uploadTx = tx as ZeroGUploadTx;
  if ("rootHash" in uploadTx) {
    return { rootHash: uploadTx.rootHash, txHash: uploadTx.txHash, provider: "0g" };
  }

  return {
    rootHash: uploadTx.rootHashes[0],
    txHash: uploadTx.txHashes?.[0],
    provider: "0g"
  };
}

function getArchiveEncryptionKey() {
  const configured = process.env.MEMORY_ENCRYPTION_KEY;
  if (!configured) return null;
  const key = Buffer.from(configured, "base64");
  return key.length === 32 ? key : null;
}

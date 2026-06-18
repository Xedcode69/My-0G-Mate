import crypto from "node:crypto";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/prisma";

export function createNonce() {
  return crypto.randomBytes(16).toString("hex");
}

export async function createSigninMessage(address: string, domain: string, uri: string) {
  const walletAddress = address.toLowerCase();
  const nonce = createNonce();
  await prisma.user.upsert({
    where: { walletAddress },
    update: { nonce },
    create: { walletAddress, nonce }
  });

  return new SiweMessage({
    domain,
    address,
    statement: "Sign in to MyMate and access your companion.",
    uri,
    version: "1",
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 1),
    nonce
  }).prepareMessage();
}

export async function verifySigninMessage(message: string, signature: string) {
  const siwe = new SiweMessage(message);
  const walletAddress = siwe.address.toLowerCase();
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user || user.nonce !== siwe.nonce) return null;

  const result = await siwe.verify({ signature });
  if (!result.success) return null;

  return prisma.user.update({
    where: { walletAddress },
    data: { nonce: createNonce() }
  });
}

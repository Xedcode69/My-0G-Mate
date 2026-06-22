import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const anchorSchema = z.object({
  snapshotVersion: z.number().int().positive(),
  transactionHash: z.string().trim().min(10).max(160)
});

export async function GET(request: Request, context: { params: Promise<{ companionId: string }> }) {
  const walletAddress = walletFromRequest(request);
  if (!walletAddress) return jsonError("Missing wallet address", 401);
  const { companionId } = await context.params;
  const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, select: { blockchainId: true } });
  if (!companion) return jsonError("Companion not found", 404);
  const snapshot = await prisma.memorySnapshot.findFirst({ where: { companionId }, orderBy: { snapshotVersion: "desc" } });
  return Response.json({ companion, snapshot });
}

export async function PATCH(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const body = parseJson(anchorSchema, await request.json());
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, select: { id: true } });
    if (!companion) return jsonError("Companion not found", 404);
    const snapshot = await prisma.memorySnapshot.findFirst({ where: { companionId, snapshotVersion: body.snapshotVersion } });
    if (!snapshot) return jsonError("Snapshot not found", 404);
    const updated = await prisma.memorySnapshot.update({ where: { id: snapshot.id }, data: { chainTransactionHash: body.transactionHash, anchoredAt: new Date() } });
    return Response.json({ snapshot: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to record archive anchor");
  }
}

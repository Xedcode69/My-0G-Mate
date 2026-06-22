import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ blockchainId: z.string().trim().min(1).max(80) });

export async function PATCH(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const body = parseJson(schema, await request.json());
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, select: { id: true } });
    if (!companion) return jsonError("Companion not found", 404);
    const updated = await prisma.companion.update({ where: { id: companionId }, data: { blockchainId: body.blockchainId }, select: { id: true, blockchainId: true } });
    return Response.json({ companion: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to link on-chain companion");
  }
}

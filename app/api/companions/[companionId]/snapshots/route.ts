import { archiveCompanion } from "@/lib/companion/archive-processor";
import { jsonError, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`snapshot:${walletAddress}:${companionId}`, 3, 60 * 60_000);
    if (!limit.allowed) return jsonError("Snapshot rate limit reached. Try again later.", 429);
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, select: { id: true } });
    if (!companion) return jsonError("Companion not found", 404);

    const { snapshot, upload } = await archiveCompanion(companionId);

    return Response.json({ snapshot, upload });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create memory snapshot");
  }
}

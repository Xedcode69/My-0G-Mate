import { generateCompanionPortraitSet } from "@/lib/ai/portrait";
import { jsonError, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`portrait:${walletAddress}:${companionId}`, 5, 60 * 60_000);
    if (!limit.allowed) return jsonError("Portrait generation rate limit reached. Try again later.", 429);

    const companion = await prisma.companion.findFirst({
      where: { id: companionId, user: { walletAddress } },
      include: { memories: true }
    });
    if (!companion) return jsonError("Companion not found", 404);

    const portrait = await generateCompanionPortraitSet(companion);
    const updated = await prisma.companion.update({
      where: { id: companionId },
      data: {
        generatedPortrait: portrait.image,
        portraitPrompt: portrait.prompt,
        portraitVariants: portrait.variants
      },
      include: {
        personality: true,
        agentProfile: true,
        memories: { orderBy: { importance: "desc" }, take: 12 },
        chatLogs: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    });

    return Response.json({ companion: updated, provider: portrait.provider });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to generate companion portrait");
  }
}

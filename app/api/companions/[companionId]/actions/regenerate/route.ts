import { validateCustomAgent } from "@/lib/companion/agent-validation";
import { jsonError, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`action-regeneration:${walletAddress}:${companionId}`, 3, 60 * 60_000);
    if (!limit.allowed) return jsonError("Workflow regeneration limit reached. Please try again later.", 429);
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, include: { agentProfile: true } });
    if (!companion?.agentProfile) return jsonError("Agent profile not found", 404);

    const validation = await validateCustomAgent({
      role: companion.agentProfile.role,
      mission: companion.agentProfile.mission,
      scope: companion.agentProfile.scope,
      boundaries: companion.agentProfile.boundaries,
      expertise: companion.agentProfile.expertise,
      successCriteria: companion.agentProfile.successCriteria,
      responseStyle: companion.agentProfile.responseStyle ?? undefined
    });
    if (validation.status !== "APPROVED") return jsonError(validation.reason, 422);

    const actions = await prisma.$transaction(async (tx) => {
      await tx.agentActionDefinition.deleteMany({ where: { companionId } });
      await tx.agentActionDefinition.createMany({ data: validation.suggestedActions.map((action, sortOrder) => ({ ...action, companionId, sortOrder, source: "LLM_REGENERATION" })) });
      return tx.agentActionDefinition.findMany({ where: { companionId, enabled: true }, orderBy: { sortOrder: "asc" } });
    });

    return Response.json({ actions });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to regenerate workflows");
  }
}

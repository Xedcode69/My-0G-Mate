import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { queueCompanionArchive } from "@/lib/companion/archive";

const schema = z.object({
  chatId: z.string().cuid(),
  rating: z.enum(["HELPFUL", "UNHELPFUL", "CORRECTED"]),
  note: z.string().trim().min(2).max(500).optional()
});

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`feedback:${walletAddress}:${companionId}`, 30, 60_000);
    if (!limit.allowed) return jsonError("Too many feedback submissions. Please slow down for a moment.", 429);
    const body = parseJson(schema, await request.json());

    const chat = await prisma.chatLog.findFirst({
      where: { id: body.chatId, companionId, companion: { user: { walletAddress } } },
      select: { companionResponse: true }
    });
    if (!chat) return jsonError("Conversation message not found", 404);

    const feedbackLabel = body.rating.toLowerCase();
    const memory = await prisma.agentMemory.create({
      data: {
        companionId,
        category: "FEEDBACK",
        content: [
          `User marked this companion response as ${feedbackLabel}: ${chat.companionResponse.slice(0, 500)}`,
          body.note ? `User clarification: ${body.note}` : null
        ].filter(Boolean).join("\n"),
        importance: body.rating === "CORRECTED" ? 9 : body.rating === "UNHELPFUL" ? 8 : 6,
        confidence: 1,
        tags: ["feedback", feedbackLabel]
      }
    });
    await queueCompanionArchive(companionId, "agent_feedback");

    return Response.json({ feedback: memory });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to save feedback");
  }
}

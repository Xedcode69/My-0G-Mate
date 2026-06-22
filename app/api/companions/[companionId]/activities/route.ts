import { ActivityType, CompanionMood } from "@prisma/client";
import { z } from "zod";
import { nextRelationshipScores } from "@/lib/companion/progression";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  activityType: z.nativeEnum(ActivityType),
  moodGuess: z.nativeEnum(CompanionMood).optional(),
  reflection: z.string().max(1000).optional()
});

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`activity:${walletAddress}:${companionId}`, 20, 60_000);
    if (!limit.allowed) return jsonError("Too many activity requests. Please slow down for a moment.", 429);
    const body = parseJson(schema, await request.json());
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } } });
    if (!companion) return jsonError("Companion not found", 404);

    if (await isOnCooldown(companionId, body.activityType)) return jsonError(`${body.activityType} is on cooldown`, 429);

    const guessedCorrectly = body.activityType === "PLAY_MINI_GAME" ? body.moodGuess === companion.mood : true;
    const relationship = nextRelationshipScores(companion, body.activityType === "FEED_COMPANION" ? 3 : 2);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.activityLog.create({ data: { companionId, activityType: body.activityType } });
      if (body.reflection) {
        await tx.memory.create({
          data: { companionId, memoryType: "reflection", content: body.reflection.slice(0, 250), importance: 6 }
        });
      }
      return tx.companion.update({
        where: { id: companionId },
        data: {
          mood: body.activityType === "FEED_COMPANION" ? "HAPPY" : companion.mood,
          ...relationship
        },
        include: {
          personality: true,
          agentProfile: true,
          memories: { orderBy: { importance: "desc" }, take: 12 },
          chatLogs: { orderBy: { createdAt: "desc" }, take: 20 }
        }
      });
    });

    return Response.json({ companion: updated, guessedCorrectly });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to record activity");
  }
}

async function isOnCooldown(companionId: string, activityType: ActivityType) {
  const hours = activityType === "PLAY_MINI_GAME" || activityType === "DAILY_CHECK_IN" ? 20 : 0;
  if (!hours) return false;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const recent = await prisma.activityLog.findFirst({ where: { companionId, activityType, createdAt: { gte: since } } });
  return Boolean(recent);
}

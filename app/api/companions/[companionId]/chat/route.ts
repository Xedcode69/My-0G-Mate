import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCompanionReply, type ChatMessage } from "@/lib/ai/llm";
import { adaptPersonality, extractMemoryCandidates } from "@/lib/companion/memory";
import { buildSystemPrompt } from "@/lib/companion/prompts";
import { evolutionStageFor, levelFromXp, moodAfterInteraction, nextRelationshipScores, xpRewards } from "@/lib/companion/progression";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { selectPortraitState } from "@/lib/companion/portrait-state";
import { retrieveRelevantAgentMemories } from "@/lib/companion/agent-memory";

const schema = z.object({ message: z.string().min(1).max(1200) });

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`chat:${walletAddress}:${companionId}`, 30, 60_000);
    if (!limit.allowed) return jsonError("Too many chat messages. Please slow down for a moment.", 429);
    const body = parseJson(schema, await request.json());

    const companion = await prisma.companion.findFirst({
      where: { id: companionId, user: { walletAddress } },
      include: {
        personality: true,
        agentProfile: true,
        agentMemories: { orderBy: { importance: "desc" }, take: 100 },
        agentActionRuns: { where: { status: "ACTIVE" }, orderBy: { startedAt: "desc" }, take: 1, include: { action: true } },
        memories: { orderBy: { importance: "desc" }, take: 30 },
        chatLogs: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    });
    if (!companion) return jsonError("Companion not found", 404);

    const history: ChatMessage[] = companion.chatLogs
      .slice()
      .reverse()
      .flatMap((chat) => [
        { role: "user" as const, content: chat.userMessage },
        { role: "assistant" as const, content: chat.companionResponse }
      ]);
    const relevantAgentMemories = retrieveRelevantAgentMemories(companion.agentMemories, body.message);
    const activeWorkflow = companion.agentActionRuns[0];
    const response = await generateCompanionReply([
      { role: "system", content: buildSystemPrompt(companion, relevantAgentMemories) },
      ...(activeWorkflow ? [{ role: "system" as const, content: `Active workflow: ${activeWorkflow.action.label}. ${activeWorkflow.action.workflowInstructions} Required information still to clarify: ${activeWorkflow.action.requiredInformation.join(", ")}. Completion criteria: ${activeWorkflow.action.completionCriteria}. Safety constraints: ${activeWorkflow.action.safetyConstraints.join("; ")}. Continue this workflow naturally; do not claim it is complete until the criteria are met.` }] : []),
      ...history,
      { role: "user", content: body.message }
    ]);

    const memoryCandidates = extractMemoryCandidates(body.message);
    const relationship = nextRelationshipScores(companion, memoryCandidates.length ? 3 : 2);
    const xp = companion.xp + xpRewards.ASK_COMPANION_QUESTION;
    const personalityUpdate = companion.personality
      ? adaptPersonality(companion.personality, body.message)
      : adaptPersonality({ humorScore: 50, supportivenessScore: 50, curiosityScore: 50, emotionalScore: 50, conciseScore: 50 }, body.message);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.chatLog.create({ data: { companionId, userMessage: body.message, companionResponse: response } });
      if (relevantAgentMemories.length > 0) {
        await tx.agentMemory.updateMany({
          where: { id: { in: relevantAgentMemories.map((memory) => memory.id) } },
          data: { lastUsedAt: new Date() }
        });
      }
      await tx.activityLog.create({ data: { companionId, activityType: "ASK_COMPANION_QUESTION", xpEarned: xpRewards.ASK_COMPANION_QUESTION } });
      for (const candidate of memoryCandidates) {
        const exists = await tx.memory.findFirst({
          where: { companionId, memoryType: candidate.type, content: { equals: candidate.content, mode: "insensitive" } }
        });
        if (!exists) {
          await tx.memory.create({
            data: { companionId, memoryType: candidate.type, content: candidate.content, importance: candidate.importance }
          });
        }
      }
      await tx.personalityProfile.upsert({
        where: { companionId },
        update: personalityUpdate,
        create: { companionId, ...personalityUpdate }
      });
      const memories = await tx.memory.findMany({ where: { companionId } });
      return tx.companion.update({
        where: { id: companionId },
        data: {
          xp,
          level: levelFromXp(xp),
          mood: moodAfterInteraction(0, relationship.relationshipLevel - companion.relationshipLevel),
          ...relationship,
          evolutionStage: evolutionStageFor({ xp, relationshipLevel: relationship.relationshipLevel }, memories)
        },
        include: {
          personality: true,
          agentProfile: true,
          memories: { orderBy: { importance: "desc" }, take: 12 },
          chatLogs: { orderBy: { createdAt: "desc" }, take: 20 }
        }
      });
    });

    return NextResponse.json({
      response,
      companion: updated,
      memoriesCreated: memoryCandidates.length,
      portraitState: selectPortraitState(body.message, response)
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to chat with companion");
  }
}

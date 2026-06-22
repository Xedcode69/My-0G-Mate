import { NextResponse } from "next/server";
import { z } from "zod";
import { generateCompanionReply } from "@/lib/ai/llm";
import { workflowDefinitionsForAgent } from "@/lib/companion/agent-templates";
import { buildSystemPrompt } from "@/lib/companion/prompts";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ actionId: z.string().cuid() });

export async function GET(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, include: { agentProfile: true } });
    if (!companion) return jsonError("Companion not found", 404);

    let actions = await prisma.agentActionDefinition.findMany({ where: { companionId, enabled: true }, orderBy: { sortOrder: "asc" } });
    if (actions.length === 0) {
      const templates = workflowDefinitionsForAgent(companion.agentProfile ?? undefined);
      await prisma.agentActionDefinition.createMany({ data: templates.map((action) => ({ ...action, companionId, source: "BACKFILL" })) });
      actions = await prisma.agentActionDefinition.findMany({ where: { companionId, enabled: true }, orderBy: { sortOrder: "asc" } });
    }

    return Response.json({ actions });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load agent actions");
  }
}

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`agent-action:${walletAddress}:${companionId}`, 12, 60_000);
    if (!limit.allowed) return jsonError("Too many workflow starts. Please slow down for a moment.", 429);
    const body = parseJson(schema, await request.json());
    const companion = await prisma.companion.findFirst({
      where: { id: companionId, user: { walletAddress } },
      include: { personality: true, agentProfile: true, agentMemories: { orderBy: { importance: "desc" }, take: 20 }, memories: { orderBy: { importance: "desc" }, take: 20 } }
    });
    if (!companion) return jsonError("Companion not found", 404);
    const action = await prisma.agentActionDefinition.findFirst({ where: { id: body.actionId, companionId, enabled: true } });
    if (!action) return jsonError("Agent action not found", 404);

    const response = await generateCompanionReply([
      { role: "system", content: buildSystemPrompt(companion) },
      { role: "system", content: `An agent workflow has just started. Workflow: ${action.label}. ${action.workflowInstructions} Required information: ${action.requiredInformation.join(", ")}. Completion criteria: ${action.completionCriteria}. Safety constraints: ${action.safetyConstraints.join("; ")}. Start by asking this opening question, naturally and only once: ${action.starterQuestion}` },
      { role: "user", content: `I selected the workflow: ${action.label}.` }
    ]);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.agentActionRun.updateMany({ where: { companionId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
      const run = await tx.agentActionRun.create({ data: { companionId, actionId: action.id } });
      await tx.chatLog.create({ data: { companionId, userMessage: `Started workflow: ${action.label}`, companionResponse: response } });
      const updatedCompanion = await tx.companion.findUniqueOrThrow({
        where: { id: companionId },
        include: { personality: true, agentProfile: true, memories: { orderBy: { importance: "desc" }, take: 12 }, chatLogs: { orderBy: { createdAt: "desc" }, take: 20 } }
      });
      return { run, companion: updatedCompanion };
    });

    return NextResponse.json({ ...updated, response });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to start agent workflow");
  }
}

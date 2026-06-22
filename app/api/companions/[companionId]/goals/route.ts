import { AgentGoalStatus } from "@prisma/client";
import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { queueCompanionArchive } from "@/lib/companion/archive";

const sharedFields = {
  title: z.string().trim().min(2).max(160),
  priority: z.number().int().min(1).max(5).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  nextStep: z.string().trim().min(2).max(500).optional(),
  status: z.nativeEnum(AgentGoalStatus).optional()
};

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), ...sharedFields, description: z.string().trim().min(2).max(1000).optional() }),
  z.object({ kind: z.literal("goal"), ...sharedFields, projectId: z.string().cuid().optional() })
]);

export async function GET(request: Request, context: { params: Promise<{ companionId: string }> }) {
  const walletAddress = walletFromRequest(request);
  if (!walletAddress) return jsonError("Missing wallet address", 401);
  const { companionId } = await context.params;

  const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, select: { id: true } });
  if (!companion) return jsonError("Companion not found", 404);

  const [projects, goals] = await Promise.all([
    prisma.agentProject.findMany({ where: { companionId }, orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }], include: { goals: { orderBy: [{ status: "asc" }, { priority: "asc" }] } } }),
    prisma.agentGoal.findMany({ where: { companionId, projectId: null }, orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }] })
  ]);

  return Response.json({ projects, goals });
}

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const body = parseJson(createSchema, await request.json());
    const companion = await prisma.companion.findFirst({ where: { id: companionId, user: { walletAddress } }, select: { id: true } });
    if (!companion) return jsonError("Companion not found", 404);

    if (body.kind === "project") {
      const project = await prisma.agentProject.create({
        data: { companionId, title: body.title, description: body.description, priority: body.priority, progress: body.progress, nextStep: body.nextStep, status: body.status }
      });
      await queueCompanionArchive(companionId, "project_created");
      return Response.json({ project }, { status: 201 });
    }

    if (body.projectId) {
      const project = await prisma.agentProject.findFirst({ where: { id: body.projectId, companionId }, select: { id: true } });
      if (!project) return jsonError("Project not found", 404);
    }
    const goal = await prisma.agentGoal.create({
      data: { companionId, projectId: body.projectId, title: body.title, priority: body.priority, progress: body.progress, nextStep: body.nextStep, status: body.status }
    });
    await queueCompanionArchive(companionId, "goal_created");
    return Response.json({ goal }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create agent work item");
  }
}

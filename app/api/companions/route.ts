import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { CompanionType } from "@prisma/client";
import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { defaultAgentTemplate } from "@/lib/companion/agent-templates";
import { workflowDefinitionsForAgent } from "@/lib/companion/agent-templates";

const agentProfileSchema = z.object({
  role: z.string().trim().min(2).max(80),
  mission: z.string().trim().min(10).max(500),
  scope: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  boundaries: z.array(z.string().trim().min(2).max(160)).max(12),
  expertise: z.array(z.string().trim().min(2).max(80)).max(12),
  successCriteria: z.array(z.string().trim().min(2).max(160)).max(12),
  responseStyle: z.string().trim().min(2).max(160).optional(),
  templateId: z.string().trim().min(2).max(80).optional(),
  validationStatus: z.enum(["APPROVED", "NEEDS_REFINEMENT", "BLOCKED"]).optional(),
  validationNotes: z.string().trim().min(2).max(500).optional()
});

const agentActionSchema = z.object({
  key: z.string().trim().min(2).max(80),
  label: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(500),
  starterQuestion: z.string().trim().min(2).max(500),
  workflowInstructions: z.string().trim().min(2).max(2000),
  requiredInformation: z.array(z.string().trim().min(2).max(120)).max(12),
  completionCriteria: z.string().trim().min(2).max(500),
  safetyConstraints: z.array(z.string().trim().min(2).max(300)).max(12)
});

const createSchema = z.object({
  name: z.string().min(2).max(32),
  type: z.nativeEnum(CompanionType),
  customTypeName: z.string().min(2).max(40).optional(),
  avatarKey: z.string().min(2).max(40).optional(),
  avatarImage: z.string().startsWith("data:image/").max(1_000_000).optional(),
  interests: z.array(z.string().min(2).max(40)).max(16).optional(),
  username: z.string().min(2).max(32).optional(),
  agentProfile: agentProfileSchema.optional(),
  agentActions: z.array(agentActionSchema).min(1).max(5).optional()
});

export async function GET(request: Request) {
  const walletAddress = walletFromRequest(request);
  if (!walletAddress) return jsonError("Missing wallet address", 401);

  const user = await prisma.user.findUnique({
    where: { walletAddress },
    include: {
      companions: {
        include: {
          personality: true,
          agentProfile: true,
          memories: { orderBy: { importance: "desc" }, take: 8 },
          chatLogs: { orderBy: { createdAt: "desc" }, take: 20 }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  return NextResponse.json({ companions: user?.companions ?? [] });
}

export async function POST(request: Request) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const body = parseJson(createSchema, await request.json());

    if (body.type === "CUSTOM" && !body.customTypeName?.trim()) {
      return jsonError("Custom companion type name is required");
    }

    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: { username: body.username },
      create: { walletAddress, username: body.username, nonce: crypto.randomBytes(16).toString("hex") }
    });

    const profile = body.agentProfile ?? {
      role: defaultAgentTemplate.role,
      templateId: defaultAgentTemplate.id,
      mission: defaultAgentTemplate.mission,
      scope: defaultAgentTemplate.scope,
      boundaries: defaultAgentTemplate.boundaries,
      expertise: defaultAgentTemplate.expertise,
      successCriteria: defaultAgentTemplate.successCriteria,
      responseStyle: defaultAgentTemplate.responseStyle,
      validationStatus: "APPROVED" as const
    };

    const companion = await prisma.$transaction(async (tx) => {
      const created = await tx.companion.create({
        data: {
          userId: user.id,
          name: body.name,
          type: body.type,
          avatarKey: body.avatarKey ?? "default",
          customTypeName: body.type === "CUSTOM" ? body.customTypeName?.trim() : null,
          avatarImage: body.avatarImage ?? null,
          personality: { create: {} },
          agentProfile: { create: profile }
        }
      });

      const actions = body.agentActions ?? workflowDefinitionsForAgent(profile);
      await tx.agentActionDefinition.createMany({
        data: actions.map((action, index) => ({ ...action, companionId: created.id, sortOrder: index, source: body.agentActions ? "LLM_VALIDATION" : profile.templateId === "CUSTOM_AGENT" ? "ROLE_INFERENCE" : "TEMPLATE" }))
      });

      const interests = [...new Set((body.interests ?? []).map((interest) => interest.trim()).filter(Boolean))];
      if (interests.length > 0) {
        await tx.memory.createMany({
          data: interests.map((interest) => ({
            companionId: created.id,
            memoryType: "interest_area",
            content: interest,
            importance: 6
          }))
        });
      }

      if (body.type === "CUSTOM" && body.customTypeName) {
        await tx.memory.create({
          data: {
            companionId: created.id,
            memoryType: "companion_identity",
            content: `custom companion type: ${body.customTypeName.trim()}`,
            importance: 7
          }
        });
      }

      return tx.companion.findUniqueOrThrow({
        where: { id: created.id },
        include: { personality: true, agentProfile: true, memories: true, chatLogs: true }
      });
    });

    return NextResponse.json({ companion }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create companion");
  }
}

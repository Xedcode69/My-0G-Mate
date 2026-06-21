import { jsonError, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, context: { params: Promise<{ companionId: string }> }) {
  const walletAddress = walletFromRequest(request);
  if (!walletAddress) return jsonError("Missing wallet address", 401);
  const { companionId } = await context.params;

  const companion = await prisma.companion.findFirst({
    where: { id: companionId, user: { walletAddress } },
    include: { agentProfile: true }
  });
  if (!companion) return jsonError("Companion not found", 404);

  const [learned, helpful, unhelpful, corrected] = await Promise.all([
    prisma.agentMemory.findMany({
      where: { companionId, category: { in: ["PREFERENCE", "FEEDBACK", "DECISION", "GOAL"] } },
      orderBy: [{ importance: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, category: true, content: true, importance: true }
    }),
    prisma.agentMemory.count({ where: { companionId, category: "FEEDBACK", tags: { has: "helpful" } } }),
    prisma.agentMemory.count({ where: { companionId, category: "FEEDBACK", tags: { has: "unhelpful" } } }),
    prisma.agentMemory.count({ where: { companionId, category: "FEEDBACK", tags: { has: "corrected" } } })
  ]);

  return Response.json({
    insights: {
      role: companion.agentProfile?.role ?? "Personal AI companion",
      mission: companion.agentProfile?.mission ?? "Provide thoughtful everyday support.",
      capabilities: companion.agentProfile?.expertise ?? [],
      learned,
      feedback: { helpful, unhelpful, corrected }
    }
  });
}

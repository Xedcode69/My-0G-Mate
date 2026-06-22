import { buildAgentArchive } from "@/lib/companion/memory";
import { encryptCompanionJson } from "@/lib/crypto/encryption";
import { prisma } from "@/lib/prisma";
import { uploadEncryptedSnapshot } from "@/lib/zero-g/storage";

export async function archiveCompanion(companionId: string) {
  const companion = await prisma.companion.findUnique({
    where: { id: companionId },
    include: {
      user: { select: { walletAddress: true } },
      personality: true,
      memories: { orderBy: { importance: "desc" }, take: 100 },
      agentProfile: true,
      agentMemories: { orderBy: { importance: "desc" }, take: 100 },
      agentProjects: { orderBy: { updatedAt: "desc" }, take: 50 },
      agentGoals: { orderBy: { updatedAt: "desc" }, take: 100 },
      agentActions: { orderBy: { sortOrder: "asc" } },
      agentActionRuns: { orderBy: { startedAt: "desc" }, take: 50, include: { action: true } },
      chatLogs: { orderBy: { createdAt: "desc" }, take: 100 }
    }
  });
  if (!companion) throw new Error("Companion not found");

  const latest = await prisma.memorySnapshot.findFirst({ where: { companionId }, orderBy: { snapshotVersion: "desc" } });
  const snapshotVersion = (latest?.snapshotVersion ?? 0) + 1;
  const archive = buildAgentArchive(companion, snapshotVersion);
  const encrypted = encryptCompanionJson(archive, companion.user.walletAddress, companion.id);
  const upload = await uploadEncryptedSnapshot(encrypted);
  const snapshot = await prisma.memorySnapshot.create({ data: { companionId, rootHash: upload.rootHash, snapshotVersion } });

  return { snapshot, upload };
}

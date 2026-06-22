import { prisma } from "@/lib/prisma";

export async function queueCompanionArchive(companionId: string, reason: string) {
  try {
    const pending = await prisma.companionArchiveJob.findFirst({
      where: { companionId, status: "PENDING" },
      orderBy: { requestedAt: "desc" }
    });
    if (pending) return prisma.companionArchiveJob.update({ where: { id: pending.id }, data: { reason } });

    return await prisma.companionArchiveJob.create({ data: { companionId, reason } });
  } catch {
    // Archiving is asynchronous durability work and must never fail a user interaction.
    return null;
  }
}

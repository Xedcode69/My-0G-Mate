import { archiveCompanion } from "@/lib/companion/archive-processor";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const debounceSeconds = Math.max(0, Number(process.env.ARCHIVE_DEBOUNCE_SECONDS ?? 300));
  const cutoff = new Date(Date.now() - debounceSeconds * 1000);
  const jobs = await prisma.companionArchiveJob.findMany({ where: { OR: [{ status: "PENDING", requestedAt: { lte: cutoff } }, { status: "FAILED", attempts: { lt: 3 }, processedAt: { lte: cutoff } }] }, orderBy: { requestedAt: "asc" }, take: 10 });
  const results: { id: string; status: string; rootHash?: string }[] = [];

  for (const job of jobs) {
    const claim = await prisma.companionArchiveJob.updateMany({ where: { id: job.id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
    if (!claim.count) continue;
    try {
      const archive = await archiveCompanion(job.companionId);
      await prisma.companionArchiveJob.update({ where: { id: job.id }, data: { status: "COMPLETE", rootHash: archive.snapshot.rootHash, processedAt: new Date(), lastError: null } });
      results.push({ id: job.id, status: "COMPLETE", rootHash: archive.snapshot.rootHash });
    } catch (error) {
      await prisma.companionArchiveJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: error instanceof Error ? error.message.slice(0, 1000) : "Archive failed", processedAt: new Date() } });
      results.push({ id: job.id, status: "FAILED" });
    }
  }

  return Response.json({ processed: results.length, results });
}

import { buildMemorySnapshot } from "@/lib/companion/memory";
import { encryptJson } from "@/lib/crypto/encryption";
import { jsonError, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { uploadEncryptedSnapshot } from "@/lib/zero-g/storage";

export async function POST(request: Request, context: { params: Promise<{ companionId: string }> }) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const { companionId } = await context.params;
    const limit = rateLimit(`snapshot:${walletAddress}:${companionId}`, 3, 60 * 60_000);
    if (!limit.allowed) return jsonError("Snapshot rate limit reached. Try again later.", 429);
    const companion = await prisma.companion.findFirst({
      where: { id: companionId, user: { walletAddress } },
      include: { personality: true, memories: true }
    });
    if (!companion) return jsonError("Companion not found", 404);

    const latest = await prisma.memorySnapshot.findFirst({ where: { companionId }, orderBy: { snapshotVersion: "desc" } });
    const snapshotVersion = (latest?.snapshotVersion ?? 0) + 1;
    const upload = await uploadEncryptedSnapshot(encryptJson({ ...buildMemorySnapshot(companion), snapshotVersion }));
    const snapshot = await prisma.memorySnapshot.create({
      data: { companionId, rootHash: upload.rootHash, snapshotVersion }
    });

    return Response.json({ snapshot, upload });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create memory snapshot");
  }
}

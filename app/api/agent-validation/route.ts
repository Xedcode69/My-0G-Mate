import { z } from "zod";
import { validateCustomAgent } from "@/lib/companion/agent-validation";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  role: z.string().max(80),
  mission: z.string().max(500),
  scope: z.array(z.string().max(80)).max(12),
  boundaries: z.array(z.string().max(160)).max(12),
  expertise: z.array(z.string().max(80)).max(12),
  successCriteria: z.array(z.string().max(160)).max(12),
  responseStyle: z.string().max(160).optional()
});

export async function POST(request: Request) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const limit = rateLimit(`agent-validation:${walletAddress}`, 10, 60 * 60_000);
    if (!limit.allowed) return jsonError("Agent validation limit reached. Please try again later.", 429);
    const definition = parseJson(schema, await request.json());
    return Response.json({ validation: await validateCustomAgent(definition) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to validate agent definition");
  }
}

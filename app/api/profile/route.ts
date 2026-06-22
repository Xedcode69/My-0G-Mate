import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const profileSchema = z.object({
  username: z.string().trim().min(2).max(32)
});

export async function GET(request: Request) {
  const walletAddress = walletFromRequest(request);
  if (!walletAddress) return jsonError("Missing wallet address", 401);

  const user = await prisma.user.findUnique({
    where: { walletAddress },
    select: { username: true, walletAddress: true }
  });
  if (!user) return jsonError("Profile not found", 404);

  return NextResponse.json({ profile: user });
}

export async function PATCH(request: Request) {
  try {
    const walletAddress = walletFromRequest(request);
    if (!walletAddress) return jsonError("Missing wallet address", 401);
    const body = parseJson(profileSchema, await request.json());

    const profile = await prisma.user.update({
      where: { walletAddress },
      data: { username: body.username },
      select: { username: true, walletAddress: true }
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to save profile");
  }
}

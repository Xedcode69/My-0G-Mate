import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { CompanionType } from "@prisma/client";
import { z } from "zod";
import { jsonError, parseJson, walletFromRequest } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2).max(32),
  type: z.nativeEnum(CompanionType),
  username: z.string().min(2).max(32).optional()
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

    const user = await prisma.user.upsert({
      where: { walletAddress },
      update: { username: body.username },
      create: { walletAddress, username: body.username, nonce: crypto.randomBytes(16).toString("hex") }
    });

    const companion = await prisma.companion.create({
      data: {
        userId: user.id,
        name: body.name,
        type: body.type,
        personality: { create: {} }
      },
      include: { personality: true, memories: true, chatLogs: true }
    });

    return NextResponse.json({ companion }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create companion");
  }
}

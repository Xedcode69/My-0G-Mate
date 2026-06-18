import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySigninMessage } from "@/lib/auth/siwe";
import { jsonError, parseJson } from "@/lib/http";

const schema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = parseJson(schema, await request.json());
    const user = await verifySigninMessage(body.message, body.signature);
    if (!user) return jsonError("Invalid signature", 401);
    const response = NextResponse.json({ user: { id: user.id, walletAddress: user.walletAddress, username: user.username } });
    response.cookies.set("mymate_wallet", user.walletAddress, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
    return response;
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to verify wallet", 401);
  }
}

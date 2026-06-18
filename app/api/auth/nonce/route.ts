import { NextResponse } from "next/server";
import { z } from "zod";
import { createSigninMessage } from "@/lib/auth/siwe";
import { jsonError, parseJson } from "@/lib/http";

const schema = z.object({ address: z.string().min(4) });

export async function POST(request: Request) {
  try {
    const body = parseJson(schema, await request.json());
    const url = new URL(request.url);
    const message = await createSigninMessage(body.address, url.host, url.origin);
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create sign-in message");
  }
}

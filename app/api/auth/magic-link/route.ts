import { NextRequest, NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { email?: string };

  if (!body.email || !body.email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const token = createMagicToken(body.email.toLowerCase().trim());
  const url = new URL(`/auth/callback?token=${encodeURIComponent(token)}`, request.url);

  return NextResponse.json({ magicLink: url.toString() });
}

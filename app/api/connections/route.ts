import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { encryptToken } from "@/lib/crypto";
import { getAuthenticatedUserOrNull } from "@/lib/require-authenticated-user";
import { prisma } from "@/lib/prisma";

const createConnectionSchema = z.object({
  provider: z.literal("pinterest"),
  name: z.string().trim().min(2).max(80),
  accessToken: z.string().trim().min(20)
});

export async function GET() {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const connections = await prisma.connection.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      provider: true,
      name: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ provider: "asc" }, { updatedAt: "desc" }]
  });

  return NextResponse.json({ connections });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const encryptedJson = encryptToken(
    JSON.stringify({
      accessToken: input.accessToken,
      updatedAt: new Date().toISOString()
    })
  );

  const existing = await prisma.connection.findFirst({
    where: {
      userId: user.id,
      provider: input.provider,
      name: input.name
    },
    select: { id: true }
  });

  const connection = existing
    ? await prisma.connection.update({
        where: { id: existing.id },
        data: { encryptedJson },
        select: {
          id: true,
          provider: true,
          name: true,
          createdAt: true,
          updatedAt: true
        }
      })
    : await prisma.connection.create({
        data: {
          userId: user.id,
          provider: input.provider,
          name: input.name,
          encryptedJson
        },
        select: {
          id: true,
          provider: true,
          name: true,
          createdAt: true,
          updatedAt: true
        }
      });

  return NextResponse.json({ connection }, { status: existing ? 200 : 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/active-user";

const schema = z.object({
  apiKey: z.string().trim().min(10)
});

export async function GET() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const secret = await prisma.connection.findFirst({
    where: {
      userId: user.id,
      provider: "leonardo_key"
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    hasKey: Boolean(secret),
    updatedAt: secret?.updatedAt ?? null
  });
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encryptedJson = encryptToken(JSON.stringify({ apiKey: parsed.data.apiKey }));
  const existing = await prisma.connection.findFirst({
    where: {
      userId: user.id,
      provider: "leonardo_key"
    }
  });

  const connection = existing
    ? await prisma.connection.update({
        where: { id: existing.id },
        data: {
          name: "Leonardo personal key",
          encryptedJson
        },
        select: {
          id: true,
          updatedAt: true
        }
      })
    : await prisma.connection.create({
        data: {
          userId: user.id,
          provider: "leonardo_key",
          name: "Leonardo personal key",
          encryptedJson
        },
        select: {
          id: true,
          updatedAt: true
        }
      });

  return NextResponse.json({
    hasKey: true,
    updatedAt: connection.updatedAt
  });
}

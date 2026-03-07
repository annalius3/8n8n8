import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/active-user";

const redditSchema = z.object({
  clientId: z.string().trim().min(3),
  clientSecret: z.string().trim().min(6),
  username: z.string().trim().min(2),
  password: z.string().trim().min(3),
  userAgent: z.string().trim().min(6)
});

async function getRedditConnection(userId: string) {
  return prisma.connection.findFirst({
    where: {
      userId,
      provider: "reddit_api"
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

async function getRedditStatus(userId: string) {
  const connection = await getRedditConnection(userId);
  return {
    configured: Boolean(connection),
    updatedAt: connection?.updatedAt ?? null,
    name: connection?.name ?? "Reddit API"
  };
}

export async function GET() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  return NextResponse.json(await getRedditStatus(user.id));
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = redditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encryptedJson = encryptToken(JSON.stringify(parsed.data));
  const existing = await getRedditConnection(user.id);

  if (existing) {
    await prisma.connection.update({
      where: { id: existing.id },
      data: {
        name: "Reddit API",
        encryptedJson
      }
    });
  } else {
    await prisma.connection.create({
      data: {
        userId: user.id,
        provider: "reddit_api",
        name: "Reddit API",
        encryptedJson
      }
    });
  }

  return NextResponse.json(await getRedditStatus(user.id));
}

export async function DELETE() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const existing = await getRedditConnection(user.id);
  if (existing) {
    await prisma.connection.delete({
      where: { id: existing.id }
    });
  }

  return NextResponse.json(await getRedditStatus(user.id));
}

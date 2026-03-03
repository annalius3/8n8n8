import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getActiveUser } from "@/lib/active-user";

const createSchema = z.object({
  name: z.string().trim().max(100).optional().default(""),
  apiKey: z.string().trim().min(10)
});

const idSchema = z.object({
  id: z.string().trim().min(1)
});

async function listLeonardoKeys(userId: string) {
  const keys = await prisma.connection.findMany({
    where: {
      userId,
      provider: "leonardo_key"
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      name: true,
      updatedAt: true
    }
  });

  return keys.map((item, index) => ({
    id: item.id,
    name: item.name,
    updatedAt: item.updatedAt,
    isPrimary: index === 0
  }));
}

export async function GET() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const keys = await listLeonardoKeys(user.id);
  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.connection.create({
    data: {
      userId: user.id,
      provider: "leonardo_key",
      name: parsed.data.name || "Leonardo key",
      encryptedJson: encryptToken(JSON.stringify({ apiKey: parsed.data.apiKey }))
    }
  });

  const keys = await listLeonardoKeys(user.id);
  return NextResponse.json({ keys });
}

export async function PATCH(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.connection.findFirst({
    where: {
      id: parsed.data.id,
      userId: user.id,
      provider: "leonardo_key"
    }
  });

  if (!existing) {
    return NextResponse.json({ error: "Leonardo key not found" }, { status: 404 });
  }

  await prisma.connection.update({
    where: { id: existing.id },
    data: {
      name: existing.name,
      encryptedJson: existing.encryptedJson
    }
  });

  const keys = await listLeonardoKeys(user.id);
  return NextResponse.json({ keys });
}

export async function DELETE(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = idSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.connection.findFirst({
    where: {
      id: parsed.data.id,
      userId: user.id,
      provider: "leonardo_key"
    },
    select: { id: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "Leonardo key not found" }, { status: 404 });
  }

  await prisma.connection.delete({
    where: { id: existing.id }
  });

  const keys = await listLeonardoKeys(user.id);
  return NextResponse.json({ keys });
}

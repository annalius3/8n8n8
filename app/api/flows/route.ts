import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { prisma } from "@/lib/prisma";
import { createCampaign } from "@/lib/campaigns/service";

const createSchema = z.object({
  name: z.string().trim().min(2).optional(),
  seedTopic: z.string().trim().min(3),
  language: z.enum(["EN", "RU", "UA"]).default("EN"),
  niche: z.string().trim().optional(),
  audience: z.string().trim().optional(),
  tone: z.string().trim().optional(),
  postsPerDay: z.number().int().min(1).max(50).default(3),
  timezone: z.string().trim().default("Europe/Kiev"),
  startTime: z.string().trim().default("09:00"),
  autopublishEnabled: z.boolean().default(false)
});

export async function GET() {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const flows = await prisma.flow.findMany({
    where: { userId: user.id },
    include: {
      schedule: true,
      steps: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json(flows);
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const flow = await createCampaign(user.id, parsed.data);

  return NextResponse.json(
    {
      flowId: flow.id
    },
    { status: 201 }
  );
}

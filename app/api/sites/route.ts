import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { createSite, listSites } from "@/lib/sites/service";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  domain: z.string().trim().min(3).max(255),
  notes: z.string().trim().max(1000).optional()
});

export async function GET() {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sites = await listSites(user.id);
  return NextResponse.json({ sites });
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const site = await createSite({
    userId: user.id,
    ...parsed.data
  });

  return NextResponse.json({ site }, { status: 201 });
}

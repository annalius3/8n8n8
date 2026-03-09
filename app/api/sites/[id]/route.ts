import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { deleteSite, getSiteForUser, updateSite } from "@/lib/sites/service";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  domain: z.string().trim().min(3).max(255).optional(),
  notes: z.string().trim().max(1000).nullable().optional()
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const site = await getSiteForUser(id, user.id);
  return NextResponse.json({ site });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const site = await updateSite({ siteId: id, userId: user.id, ...parsed.data });
  return NextResponse.json({ site });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  await deleteSite(id, user.id);
  return NextResponse.json({ deleted: true });
}

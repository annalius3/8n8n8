import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { attachSearchConsoleProperty } from "@/lib/sites/service";

const schema = z.object({
  propertyUrl: z.string().trim().min(5),
  googleAccountEmail: z.string().trim().email().optional().nullable()
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const connection = await attachSearchConsoleProperty({
    siteId: id,
    userId: user.id,
    ...parsed.data
  });

  return NextResponse.json({ connection });
}

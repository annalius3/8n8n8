import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { planScheduleForFlow } from "@/lib/campaigns/service";

type Params = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  mode: z.enum(["default", "hourly"]).optional().default("default")
});

export async function POST(request: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id } = await params;
  const result = await planScheduleForFlow(id, user.id, parsed.data.mode);
  return NextResponse.json(result);
}

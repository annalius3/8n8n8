import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { planScheduleForFlow } from "@/lib/campaigns/service";

type Params = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  mode: z.enum(["default", "hourly", "interval_hours", "random_daily"]).optional().default("default"),
  intervalHours: z.number().int().min(1).max(24).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  timezone: z.string().min(1).optional()
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
  const result = await planScheduleForFlow(id, user.id, parsed.data);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { planScheduleForFlow } from "@/lib/campaigns/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await params;
  const result = await planScheduleForFlow(id, user.id);
  return NextResponse.json(result);
}

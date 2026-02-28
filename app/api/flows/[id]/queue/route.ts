import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { getFlowOrThrow } from "@/lib/campaigns/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await params;
  const flow = await getFlowOrThrow(id, user.id);

  return NextResponse.json({
    queueItems: flow.queueItems,
    runs: flow.runs
  });
}

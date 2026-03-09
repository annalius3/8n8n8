import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { disconnectSearchConsole } from "@/lib/sites/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  await disconnectSearchConsole(id, user.id);
  return NextResponse.json({ disconnected: true });
}

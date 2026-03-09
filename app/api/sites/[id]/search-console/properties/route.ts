import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { getAvailableSearchConsoleProperties } from "@/lib/sites/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;
  const properties = await getAvailableSearchConsoleProperties(id, user.id);
  return NextResponse.json({ properties });
}

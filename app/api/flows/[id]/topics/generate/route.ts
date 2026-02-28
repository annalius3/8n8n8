import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { generateTopicsForCampaign } from "@/lib/campaigns/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "��������� �����������" }, { status: 401 });
  }

  const { id } = await params;
  const result = await generateTopicsForCampaign(id, user.id);

  return NextResponse.json(result);
}

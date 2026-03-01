import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { toPublicOpenAIErrorMessage } from "@/lib/campaigns/openai";
import { generateTopicsForCampaign } from "@/lib/campaigns/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await generateTopicsForCampaign(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: toPublicOpenAIErrorMessage(error) }, { status: 400 });
  }
}


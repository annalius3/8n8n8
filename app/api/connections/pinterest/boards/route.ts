import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserOrNull } from "@/lib/require-authenticated-user";
import { listPinterestBoards } from "@/lib/integrations/pinterest";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const connectionName = request.nextUrl.searchParams.get("connectionName") ?? undefined;

  try {
    const boards = await listPinterestBoards({
      userId: user.id,
      connectionName
    });
    return NextResponse.json({ boards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pinterest request failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}


import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This route is deprecated. Use POST /api/flows to create a flow and POST /api/flows/[id]/topics/generate to generate topics."
    },
    { status: 410 }
  );
}


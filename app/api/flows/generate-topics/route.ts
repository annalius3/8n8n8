import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Маршрут устарел. Используйте POST /api/flows для создания потока и POST /api/flows/[id]/topics/generate для генерации тем."
    },
    { status: 410 }
  );
}

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "������� �������. ����������� POST /api/flows ��� �������� ������ � POST /api/flows/[id]/topics/generate ��� ��������� ���."
    },
    { status: 410 }
  );
}

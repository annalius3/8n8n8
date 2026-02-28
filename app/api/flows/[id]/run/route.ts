import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/active-user";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: NextRequest, { params }: Params) {
  const user = await getActiveUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await params;
  const flow = await prisma.flow.findFirst({
    where: { id, userId: user.id },
    include: {
      steps: {
        select: {
          type: true
        }
      }
    }
  });

  if (!flow) {
    return NextResponse.json({ error: "Поток не найден" }, { status: 404 });
  }

  const hasLegacySourceStep = flow.steps.some((step) => step.type === "rss" || step.type === "queue");
  if (!hasLegacySourceStep) {
    return NextResponse.json(
      {
        error: "Для нового потока используйте шаги «Темы» и «Очередь»: сначала добавьте темы, затем генерируйте и публикуйте элементы очереди."
      },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      error: "Legacy Run now отключён для этой версии продукта."
    },
    { status: 409 }
  );
}

import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { LeonardoSettingsForm } from "@/components/leonardo-settings-form";

export default async function SettingsPage() {
  const user = await requireUser("/settings");

  const secret = await prisma.connection.findFirst({
    where: {
      userId: user.id,
      provider: "leonardo_key"
    },
    orderBy: {
      updatedAt: "desc"
    }
  });

  return (
    <div className="space-y-6">
      <LeonardoSettingsForm hasKey={Boolean(secret)} updatedAt={secret?.updatedAt.toISOString() ?? null} />
    </div>
  );
}

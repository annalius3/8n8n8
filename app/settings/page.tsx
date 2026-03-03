import { requireUser } from "@/lib/require-user";
import { prisma } from "@/lib/prisma";
import { LeonardoSettingsForm } from "@/components/leonardo-settings-form";

export default async function SettingsPage() {
  const user = await requireUser("/settings");

  const secrets = await prisma.connection.findMany({
    where: {
      userId: user.id,
      provider: "leonardo_key"
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      name: true,
      updatedAt: true
    }
  });

  return (
    <div className="space-y-6">
      <LeonardoSettingsForm
        keys={secrets.map((secret, index) => ({
          id: secret.id,
          name: secret.name,
          updatedAt: secret.updatedAt.toISOString(),
          isPrimary: index === 0
        }))}
      />
    </div>
  );
}

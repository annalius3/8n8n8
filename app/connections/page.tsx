import { ConnectionSettingsForm } from "@/components/connection-settings-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/require-authenticated-user";

export default async function ConnectionsPage() {
  const user = await requireAuthenticatedUser("/connections");

  const connections = await prisma.connection.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      provider: true,
      name: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [{ provider: "asc" }, { updatedAt: "desc" }]
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{"\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {
              "\u0417\u0434\u0435\u0441\u044c \u0445\u0440\u0430\u043d\u044f\u0442\u0441\u044f \u0440\u0435\u0430\u043b\u044c\u043d\u044b\u0435 \u0441\u0435\u0440\u0432\u0435\u0440\u043d\u044b\u0435 \u0442\u043e\u043a\u0435\u043d\u044b \u0438\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0439. \u0414\u043e\u0441\u0442\u0443\u043f \u043a \u044d\u0442\u043e\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435 \u0435\u0441\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0443 \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u043e\u0432\u0430\u043d\u043d\u043e\u0433\u043e \u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044f."
            }
          </p>
          <p>
            {
              "\u0421\u0435\u0439\u0447\u0430\u0441 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0451\u043d \u0442\u043e\u043b\u044c\u043a\u043e \u0441\u0435\u0440\u0432\u0435\u0440\u043d\u044b\u0439 \u043a\u043e\u043d\u0442\u0443\u0440 \u0434\u043b\u044f Pinterest: \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435 \u0442\u043e\u043a\u0435\u043d\u0430, \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u0430 \u0438 \u0441\u043f\u0438\u0441\u043e\u043a \u0434\u043e\u0441\u043e\u043a."
            }
          </p>
        </CardContent>
      </Card>
      <ConnectionSettingsForm
        initialConnections={connections.map((connection) => ({
          ...connection,
          createdAt: connection.createdAt.toISOString(),
          updatedAt: connection.updatedAt.toISOString()
        }))}
      />
    </div>
  );
}

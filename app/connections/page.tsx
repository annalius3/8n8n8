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
          <CardTitle>Connections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Real server-side integration tokens are stored here. Only an authenticated user can access this page.</p>
          <p>Pinterest can be connected through OAuth or by saving an existing access token as a fallback.</p>
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

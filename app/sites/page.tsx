import { requireUser } from "@/lib/require-user";
import { listSites } from "@/lib/sites/service";
import { SitesManager } from "@/components/sites-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export default async function SitesPage() {
  const user = await requireUser("/sites");
  try {
    const sites = await listSites(user.id);

    return <SitesManager initialSites={sites.map((site) => ({ ...site, createdAt: site.createdAt.toISOString(), updatedAt: site.updatedAt.toISOString(), lastSyncAt: site.lastSyncAt?.toISOString() ?? null }))} />;
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Сайты временно недоступны</CardTitle>
          <p className="text-sm text-muted-foreground">
            Приложение не смогло загрузить данные сайтов из production-базы. Проверьте `DATABASE_URL`, выполните `prisma migrate deploy`
            и перезапустите deployment.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <LinkButton href="/flows">Потоки</LinkButton>
          <LinkButton href="/" variant="outline">На главную</LinkButton>
        </CardContent>
      </Card>
    );
  }
}

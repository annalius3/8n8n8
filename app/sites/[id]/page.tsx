import { SearchConsolePeriod } from "@prisma/client";
import { SiteDetailManager } from "@/components/site-detail-manager";
import { requireUser } from "@/lib/require-user";
import { getSiteAnalytics } from "@/lib/sites/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string; period?: SearchConsolePeriod }>;
};

export default async function SiteDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("/sites");

  try {
    const { id } = await params;
    const resolvedSearch = (await searchParams) ?? {};
    const analytics = await getSiteAnalytics({
      siteId: id,
      userId: user.id,
      period: resolvedSearch.period
    });

    return <SiteDetailManager initialAnalytics={JSON.parse(JSON.stringify(analytics))} initialTab={resolvedSearch.tab ?? "overview"} />;
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Детали сайта временно недоступны</CardTitle>
          <p className="text-sm text-muted-foreground">
            Приложение не смогло загрузить аналитику Search Console. Проверьте production-базу, миграции и Google credentials.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <LinkButton href="/sites">К списку сайтов</LinkButton>
          <LinkButton href="/settings" variant="outline">Настройки</LinkButton>
        </CardContent>
      </Card>
    );
  }
}

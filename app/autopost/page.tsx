import { AutoPostManager } from "@/components/autopost-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAutoPostDashboard } from "@/lib/autopost/service";
import { requireUser } from "@/lib/require-user";

export default async function AutoPostPage() {
  const user = await requireUser("/autopost");
  const dashboard = await getAutoPostDashboard(user.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Автопостинг статей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Нажмите «Сканировать и добавить статьи», чтобы подтянуть новые статьи с сайта.</p>
          <p>2. У нужной статьи нажмите `Generate`, чтобы создать тексты под платформы.</p>
          <p>3. Нажмите `Publish`, чтобы отправить посты на включенные платформы.</p>
          <p>4. Статусы, время публикации и ошибки отображаются в таблице ниже.</p>
        </CardContent>
      </Card>

      <AutoPostManager
        initialData={{
          sourceConfig: dashboard.sourceConfig
            ? {
                rssUrl: dashboard.sourceConfig.rssUrl,
                enabled: dashboard.sourceConfig.enabled,
                immediatePublishEnabled: dashboard.sourceConfig.immediatePublishEnabled,
                assetsPersistenceEnabled: dashboard.sourceConfig.assetsPersistenceEnabled,
                lastScannedAt: dashboard.sourceConfig.lastScannedAt?.toISOString() ?? null
              }
            : null,
          platformSettings: dashboard.platformSettings,
          articles: dashboard.articles.map((article) => ({
            id: article.id,
            title: article.title,
            category: article.category,
            canonicalUrl: article.canonicalUrl,
            publishedAt: article.publishedAt.toISOString(),
            autopostEnabled: article.autopostEnabled,
            jobs: article.jobs.map((job) => ({
              id: job.id,
              platform: job.platform,
              status: job.status,
              scheduledAt: job.scheduledAt?.toISOString() ?? null,
              publishedAt: job.publishedAt?.toISOString() ?? null,
              errorMessage: job.errorMessage,
              externalPostId: job.externalPostId
            }))
          })),
          jobsByStatus: dashboard.jobsByStatus.map((row) => ({
            status: row.status,
            _count: row._count
          }))
        }}
      />
    </div>
  );
}

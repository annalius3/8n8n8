import { SearchConsolePeriod } from "@prisma/client";
import { SiteDetailManager } from "@/components/site-detail-manager";
import { requireUser } from "@/lib/require-user";
import { getSiteAnalytics } from "@/lib/sites/service";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string; period?: SearchConsolePeriod }>;
};

export default async function SiteDetailPage({ params, searchParams }: PageProps) {
  const user = await requireUser("/sites");
  const { id } = await params;
  const resolvedSearch = (await searchParams) ?? {};
  const analytics = await getSiteAnalytics({
    siteId: id,
    userId: user.id,
    period: resolvedSearch.period
  });

  return <SiteDetailManager initialAnalytics={JSON.parse(JSON.stringify(analytics))} initialTab={resolvedSearch.tab ?? "overview"} />;
}

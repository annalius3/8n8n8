import { requireUser } from "@/lib/require-user";
import { listSites } from "@/lib/sites/service";
import { SitesManager } from "@/components/sites-manager";

export default async function SitesPage() {
  const user = await requireUser("/sites");
  const sites = await listSites(user.id);

  return <SitesManager initialSites={sites.map((site) => ({ ...site, createdAt: site.createdAt.toISOString(), updatedAt: site.updatedAt.toISOString(), lastSyncAt: site.lastSyncAt?.toISOString() ?? null }))} />;
}

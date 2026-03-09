import { SiteForm } from "@/components/site-form";
import { requireUser } from "@/lib/require-user";

export default async function NewSitePage() {
  await requireUser("/sites/new");

  return <SiteForm />;
}

import { notFound } from "next/navigation";
import { SiteFormInner } from "@/components/site-form";
import { requireUser } from "@/lib/require-user";
import { getSiteForUser } from "@/lib/sites/service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSitePage({ params }: PageProps) {
  const user = await requireUser("/sites");
  const { id } = await params;

  try {
    const site = await getSiteForUser(id, user.id);

    return (
      <SiteFormInner
        initialValues={{
          name: site.name,
          domain: site.domain,
          notes: site.notes
        }}
        submitUrl={`/api/sites/${site.id}`}
        method="PATCH"
        title="Редактировать сайт"
        submitLabel="Сохранить изменения"
        savingLabel="Сохраняем изменения..."
        successPath={`/sites/${site.id}?tab=settings`}
      />
    );
  } catch {
    notFound();
  }
}

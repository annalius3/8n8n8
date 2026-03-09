import { SiteForm } from "@/components/site-form";
import { requireUser } from "@/lib/require-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export default async function NewSitePage() {
  try {
    await requireUser("/sites/new");
    return <SiteForm />;
  } catch {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Создание сайта временно недоступно</CardTitle>
          <p className="text-sm text-muted-foreground">
            Не удалось подготовить форму из-за ошибки production-базы или авторизации.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <LinkButton href="/sites">К списку сайтов</LinkButton>
          <LinkButton href="/login" variant="outline">Войти заново</LinkButton>
        </CardContent>
      </Card>
    );
  }
}

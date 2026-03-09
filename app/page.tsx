import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Scheduled Publishing</CardTitle>
          <p className="text-sm text-muted-foreground">
            Управляйте потоками публикаций, подключениями и аналитикой сайтов из одного интерфейса.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <LinkButton href="/login">Войти</LinkButton>
          <LinkButton href="/flows" variant="outline">Потоки</LinkButton>
          <LinkButton href="/sites" variant="outline">Сайты</LinkButton>
          <LinkButton href="/connections" variant="outline">Подключения</LinkButton>
        </CardContent>
      </Card>
    </div>
  );
}

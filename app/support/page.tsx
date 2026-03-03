import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Поддержка | Autoposting Flow",
  description: "Информация о поддержке для Autoposting Flow"
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Поддержка</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Как получить помощь</h2>
            <p>
              Используйте канал поддержки, связанный с текущим окружением, или обратитесь к владельцу проекта. Когда сообщаете о проблеме, укажите
              URL страницы, действие, которое вы выполняли, и соответствующие логи запуска или очереди.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Что лучше приложить к сообщению об ошибке</h2>
            <p>Чтобы быстрее разобраться с проблемой, приложите:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>точную страницу, где возникла проблема</li>
              <li>какую кнопку или действие вы нажали</li>
              <li>текст видимой ошибки</li>
              <li>ID запуска или элемента очереди, если он есть</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Операционные проблемы</h2>
            <p>
              Проблемы, связанные с OAuth, правами на публикацию, квотами API или сбоями внешних сервисов, могут потребовать изменения настроек у провайдера,
              а не правок в коде приложения.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

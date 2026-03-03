import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Удаление данных | Autoposting Flow",
  description: "Информация об удалении данных для Autoposting Flow"
};

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Удаление данных</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Что можно удалить из приложения</h2>
            <p>Вы можете удалить сохранённые Pinterest-подключения, потоки, элементы очереди и отключить сторонние сервисы прямо из интерфейса приложения.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Подключённые интеграции</h2>
            <p>
              Отключение интеграции удаляет сохранённую зашифрованную запись подключения из базы данных приложения. После этого приложение не сможет использовать эту интеграцию
              в будущих действиях.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Сгенерированный контент и очередь</h2>
            <p>
              Потоки, предложения тем, элементы очереди и связанные с ними логи можно удалить через приложение. Уже опубликованный контент на сторонних платформах
              может остаться там и должен удаляться отдельно при необходимости.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Запрос на полное удаление</h2>
            <p>
              Если вам нужно более полное удаление данных уровня аккаунта для текущего окружения, используйте канал поддержки этого сервиса и укажите email,
              с которым вы входили в систему.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

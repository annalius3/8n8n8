import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Политика конфиденциальности | Autoposting Flow",
  description: "Политика конфиденциальности для Autoposting Flow"
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Политика конфиденциальности</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Обзор</h2>
            <p>
              Autoposting Flow помогает планировать контент, генерировать материалы, подключать сторонние сервисы и публиковать контент по расписанию.
              Эта политика объясняет, какие данные сервис хранит и как они используются.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Какие данные мы храним</h2>
            <p>Сервис может хранить данные аккаунта, такие как email, базовую информацию профиля, настройки публикации, логи запусков, элементы очереди и метаданные подключённых интеграций.</p>
            <p>
              Чувствительные данные, например API-токены, хранятся только на сервере и шифруются перед записью в базу данных.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Как используются подключённые сервисы</h2>
            <p>
              Когда вы подключаете сервисы вроде Pinterest, Google, OpenAI или Leonardo, приложение использует эти данные только для входа в аккаунт,
              генерации контента, получения списка досок или публикации контента, который вы явно запросили.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Использование сгенерированного контента и логов</h2>
            <p>
              Приложение хранит элементы очереди, сгенерированный текст, ссылки на изображения, данные расписания и логи выполнения, чтобы вы могли управлять публикациями,
              повторять действия, проверять результаты и разбирать ошибки.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Передача данных</h2>
            <p>
              Сервис не продаёт персональные данные. Передача данных возможна только внешним провайдерам, которые нужны для работы конкретных функций:
              авторизации, генерации текста, генерации изображений и публикации.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Удаление данных</h2>
            <p>
              Вы можете отключать интеграции, удалять потоки и убирать элементы из очереди прямо в приложении. Удаление интеграции удаляет из базы соответствующую
              зашифрованную запись подключения.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Контакты</h2>
            <p>
              По вопросам конфиденциальности используйте канал связи, указанный для этого развертывания сервиса, либо обращайтесь к владельцу проекта текущего окружения.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

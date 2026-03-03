import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Условия использования | Autoposting Flow",
  description: "Условия использования для Autoposting Flow"
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Условия использования</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Объём сервиса</h2>
            <p>
              Autoposting Flow предоставляет инструменты для планирования контента, генерации текста и изображений, управления очередью публикаций и отправки контента на подключённые платформы.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Ответственность пользователя</h2>
            <p>
              Вы несёте ответственность за контент, который создаёте, планируете, генерируете и публикуете через сервис. У вас должны быть необходимые права на использование тем,
              текстов, изображений, ссылок и сторонних аккаунтов, подключённых к приложению.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Сторонние сервисы</h2>
            <p>
              Сервис опирается на внешних провайдеров, таких как Google, Pinterest, OpenAI и Leonardo. Доступность, поведение API, лимиты и цены этих сервисов
              находятся вне прямого контроля этого приложения.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Допустимое использование</h2>
            <p>
              Вы не должны использовать сервис для незаконной, вводящей в заблуждение, нарушающей чужие права или злоупотребляющей публикации. Также вы обязаны соблюдать правила
              и политики всех подключённых сторонних платформ.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Отсутствие гарантий</h2>
            <p>
              Сервис предоставляется по мере доступности. Логи выполнения, расписания и интеграции повышают надёжность, но непрерывная работа и доставка через сторонние сервисы
              не могут быть гарантированы.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

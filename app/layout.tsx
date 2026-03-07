import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";

export const metadata = {
  title: "Autoposting Flow",
  description: "Генерируйте темы, подготавливайте контент для Pinterest и запускайте автопостинг по расписанию"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="ru">
      <body>
        <div className="container-page space-y-6">
          <header className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Autoposting Flow</h1>
                <p className="text-sm text-muted-foreground">Генерируйте темы, подготавливайте контент и запускайте автопостинг в Pinterest.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Badge>Вы вошли</Badge>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Нужен вход</Badge>
                    <span className="text-sm text-muted-foreground">Войдите, чтобы управлять потоками и подключениями</span>
                  </div>
                )}
                <nav className="flex items-center gap-2">
                  <LinkButton href="/flows" variant="outline">Потоки</LinkButton>
                  <LinkButton href="/autopost" variant="outline">Auto-posting</LinkButton>
                  <LinkButton href="/connections" variant="outline">Подключения</LinkButton>
                  <LinkButton href="/settings" variant="outline">Настройки</LinkButton>
                  <LinkButton href="/runs" variant="outline">Логи</LinkButton>
                  {user ? (
                    <form action="/api/auth/logout" method="post">
                      <Button type="submit" variant="secondary">
                        Выйти
                      </Button>
                    </form>
                  ) : (
                    <LinkButton href="/login">Войти</LinkButton>
                  )}
                </nav>
              </div>
            </div>
          </header>
          {children}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
            <span>Autoposting Flow</span>
            <nav className="flex items-center gap-3">
              <a className="underline underline-offset-4" href="/privacy">Политика конфиденциальности</a>
              <a className="underline underline-offset-4" href="/terms">Условия использования</a>
              <a className="underline underline-offset-4" href="/support">Поддержка</a>
              <a className="underline underline-offset-4" href="/data-deletion">Удаление данных</a>
            </nav>
          </footer>
        </div>
      </body>
    </html>
  );
}

import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";

export const metadata = {
  title: "Autoposting Flow",
  description: "Визуальный MVP для автопостинга по шагам"
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
                <p className="text-sm text-muted-foreground">Только реальная конфигурация, реальные ключи и реальные публикации.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Badge>Авторизован</Badge>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Требуется вход</Badge>
                    <span className="text-sm text-muted-foreground">Авторизуйтесь для работы с потоками и подключениями</span>
                  </div>
                )}
                <nav className="flex items-center gap-2">
                  <LinkButton href="/flows" variant="outline">Потоки</LinkButton>
                  <LinkButton href="/connections" variant="outline">Подключения</LinkButton>
                  <LinkButton href="/settings" variant="outline">Settings</LinkButton>
                  <LinkButton href="/runs" variant="outline">Запуски</LinkButton>
                  {user ? (
                    <form action="/api/auth/logout" method="post">
                      <Button type="submit" variant="secondary">
                        Выйти
                      </Button>
                    </form>
                  ) : (
                    <LinkButton href="/login">Войти по magic link</LinkButton>
                  )}
                </nav>
              </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

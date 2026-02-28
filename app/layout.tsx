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
                <p className="text-sm text-muted-foreground">Сначала сценарий и визуализация, потом реальные ключи и OAuth.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Badge>Авторизован</Badge>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Demo режим</Badge>
                    <span className="text-sm text-muted-foreground">Можно работать без входа</span>
                  </div>
                )}
                <nav className="flex items-center gap-2">
                  <LinkButton href="/flows" variant="outline">Потоки</LinkButton>
                  <LinkButton href="/connections" variant="outline">Подключения</LinkButton>
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
            {!user ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                Сейчас открыт демо-режим. Можно создавать потоки, запускать их и смотреть логи без обязательной авторизации.
              </div>
            ) : null}
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

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
              <nav className="flex items-center gap-2">
                <Link href="/flows">
                  <Button variant="outline">Потоки</Button>
                </Link>
                <Link href="/runs">
                  <Button variant="outline">Запуски</Button>
                </Link>
                {user ? (
                  <form action="/api/auth/logout" method="post">
                    <Button type="submit" variant="secondary">
                      Выйти
                    </Button>
                  </form>
                ) : (
                  <Link href="/login">
                    <Button>Авторизация</Button>
                  </Link>
                )}
              </nav>
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

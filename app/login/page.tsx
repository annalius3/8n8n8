"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextPath = searchParams.get("next") || "/flows";
  const callbackError = searchParams.get("error");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: nextPath })
      });

      if (!response.ok) {
        setError("Не удалось создать magic link");
        return;
      }

      const data = (await response.json()) as { magicLink: string };
      setMagicLink(data.magicLink);
    } catch {
      setError("Не удалось связаться с сервером");
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Вход</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          В рабочем режиме нужна авторизация. После входа вы сможете управлять потоками, логами и токенами подключений.
        </p>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}>Продолжить через Google</LinkButton>
        </div>
        {callbackError === "auth_setup" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Не удалось завершить вход. Проверьте production-базу и Prisma migrations.
          </div>
        ) : null}
        {callbackError === "google_not_configured" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Google OAuth пока не настроен на сервере.
          </div>
        ) : null}
        {callbackError === "google_oauth" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Ошибка входа через Google. Проверьте настройки Google OAuth и redirect URI.
          </div>
        ) : null}
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-medium">Резервный вариант: magic link</p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit">Создать magic link</Button>
        </form>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {magicLink ? (
          <p className="text-sm break-all">
            Открыть ссылку: <a className="underline" href={magicLink}>{magicLink}</a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

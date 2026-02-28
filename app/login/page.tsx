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
  const [email, setEmail] = useState("demo@autoposting.local");
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
        <CardTitle>Авторизация по magic link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Для демо-режима вход не обязателен. Эта страница нужна только если вы хотите проверить упрощённую авторизацию.
        </p>
        {callbackError === "auth_setup" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Не удалось завершить вход. Скорее всего, production-база ещё не готова к записи через Prisma.
          </div>
        ) : null}
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit">Создать magic link</Button>
        </form>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {magicLink ? (
          <p className="text-sm">
            Открыть ссылку: <a className="underline" href={magicLink}>{magicLink}</a>
          </p>
        ) : null}
        <div className="border-t pt-4">
          <LinkButton href="/flows" variant="outline">Продолжить в demo режиме</LinkButton>
        </div>
      </CardContent>
    </Card>
  );
}

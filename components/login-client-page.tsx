"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkButton } from "@/components/ui/link-button";

function getGoogleErrorMessage(reason: string | null) {
  if (reason === "redirect_uri_mismatch") {
    return "Google OAuth вернул redirect_uri_mismatch. Проверьте Authorized redirect URI в Google Cloud.";
  }
  if (reason === "invalid_client") {
    return "Google OAuth вернул invalid_client. Проверьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в Vercel.";
  }
  if (reason === "invalid_grant") {
    return "Google OAuth вернул invalid_grant. Обычно это истекший или уже использованный code.";
  }
  if (reason === "missing_email") {
    return "Google не вернул email пользователя. Проверьте scope email/profile.";
  }
  if (reason === "missing_code_or_state") {
    return "В callback отсутствует code или state.";
  }
  if (reason === "invalid_state") {
    return "State token невалиден или истек.";
  }
  if (reason === "oauth_failed") {
    return "Google OAuth завершился ошибкой на этапе обмена токена или загрузки профиля.";
  }
  return "Ошибка входа через Google. Проверьте настройки Google OAuth и redirect URI.";
}

export default function LoginClientPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextPath = searchParams.get("next") || "/flows";
  const callbackError = searchParams.get("error");
  const callbackReason = searchParams.get("reason");

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
            Не удалось завершить вход. Проверьте production-базу, Prisma migrations и обязательные env.
          </div>
        ) : null}

        {callbackError === "google_not_configured" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Google OAuth пока не настроен на сервере.
          </div>
        ) : null}

        {callbackError === "google_oauth" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getGoogleErrorMessage(callbackReason)}
          </div>
        ) : null}

        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-medium">Резервный вариант: magic link</p>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <Button type="submit">Создать magic link</Button>
          </form>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {magicLink ? (
          <p className="break-all text-sm">
            Открыть ссылку:{" "}
            <a className="underline" href={magicLink}>
              {magicLink}
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

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
        setError("Failed to create a magic link");
        return;
      }

      const data = (await response.json()) as { magicLink: string };
      setMagicLink(data.magicLink);
    } catch {
      setError("Failed to reach the server");
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>Sign in with magic link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Authentication is required in real mode. After signing in, you will be able to manage flows, logs, and connection tokens.
        </p>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/api/auth/google/start?next=${encodeURIComponent(nextPath)}`}>Continue with Google</LinkButton>
        </div>
        {callbackError === "auth_setup" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Sign-in could not be completed. Check the production database and Prisma migrations.
          </div>
        ) : null}
        {callbackError === "google_not_configured" ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Google OAuth is not configured on the server yet.
          </div>
        ) : null}
        {callbackError === "google_oauth" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Google sign-in failed. Check Google OAuth settings and redirect URI.
          </div>
        ) : null}
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-medium">Fallback: magic link</p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit">Create magic link</Button>
        </form>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {magicLink ? (
          <p className="text-sm break-all">
            Open link: <a className="underline" href={magicLink}>{magicLink}</a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

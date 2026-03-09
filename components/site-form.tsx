"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SiteForm() {
  return <SiteFormInner />;
}

type SiteFormProps = {
  initialValues?: {
    name: string;
    domain: string;
    notes: string | null;
  };
  submitUrl?: string;
  method?: "POST" | "PATCH";
  title?: string;
  submitLabel?: string;
  savingLabel?: string;
  successPath?: string;
};

export function SiteFormInner({
  initialValues,
  submitUrl = "/api/sites",
  method = "POST",
  title = "Добавить сайт",
  submitLabel = "Сохранить сайт",
  savingLabel = "Сохраняем...",
  successPath
}: SiteFormProps = {}) {
  const router = useRouter();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [domain, setDomain] = useState(initialValues?.domain ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(submitUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.formErrors?.[0] || data.error || "Не удалось создать сайт");
      }

      router.push((successPath ?? `/sites/${data.site.id}?tab=settings`) as any);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label>Site name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="My main website" required />
          </div>
          <div className="space-y-2">
            <Label>Domain / base URL</Label>
            <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="https://example.com" required />
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Дополнительные заметки по сайту" rows={4} />
          </div>
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? savingLabel : submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PostPreviewCardProps = {
  title: string;
  description: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  boardId?: string | null;
  publishMode?: string | null;
  textMode?: string | null;
  imageMode?: string | null;
};

function modeLabel(mode: string | null | undefined) {
  if (!mode) return null;
  if (mode === "demo") return "Demo";
  if (mode === "real") return "Real API";
  if (mode === "template") return "Template";
  return mode;
}

export function PostPreviewCard({ title, description, imageUrl, linkUrl, boardId, publishMode, textMode, imageMode }: PostPreviewCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Preview post</CardTitle>
          <div className="flex flex-wrap gap-2">
            {modeLabel(textMode) ? <Badge variant="outline">Текст: {modeLabel(textMode)}</Badge> : null}
            {modeLabel(imageMode) ? <Badge variant="outline">Изображение: {modeLabel(imageMode)}</Badge> : null}
            {modeLabel(publishMode) ? <Badge variant="secondary">Публикация: {modeLabel(publishMode)}</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="aspect-[4/5] border-b bg-gradient-to-br from-slate-100 via-white to-slate-200">
            {imageUrl ? (
              <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                После запуска здесь появится изображение для будущего пина.
              </div>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Pin title</p>
              <p className="mt-1 text-base font-semibold">{title}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground">Pin description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Link URL</p>
                <p className="mt-1 break-all text-sm">{linkUrl ?? "—"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-muted-foreground">Pinterest board</p>
                <p className="mt-1 text-sm">{boardId ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

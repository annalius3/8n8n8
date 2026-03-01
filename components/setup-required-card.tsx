import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

type SetupRequiredCardProps = {
  title?: string;
  details?: string;
};

export function SetupRequiredCard({
  title = "The app is not connected to the database yet",
  details = "This page cannot load live data until the required Vercel environment variables and Postgres connection string are configured."
}: SetupRequiredCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{details}</p>
        <div className="rounded-lg border bg-muted/30 p-4 text-sm">
          <p className="font-medium">What to add in Vercel</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>`DATABASE_URL`</li>
            <li>`AUTH_SECRET`</li>
            <li>`ENCRYPTION_KEY`</li>
            <li>`SCHEDULER_TOKEN`</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/api/health" variant="outline">Check health</LinkButton>
          <LinkButton href="/login" variant="outline">Open login</LinkButton>
        </div>
      </CardContent>
    </Card>
  );
}

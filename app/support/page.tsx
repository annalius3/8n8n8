import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Support | Autoposting Flow",
  description: "Support information for Autoposting Flow"
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Support</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Getting help</h2>
            <p>
              Use the support channel associated with the current deployment or the project owner responsible for this environment. When reporting an issue, include the
              page URL, the action you attempted, and the relevant run or queue logs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Recommended bug report details</h2>
            <p>For faster triage, include:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>the exact page where the issue happened</li>
              <li>the action button you clicked</li>
              <li>the visible error text</li>
              <li>the related run ID or queue item ID, if available</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Operational issues</h2>
            <p>
              Problems related to OAuth, publishing permissions, API quotas, or third-party outages may require changes in external provider settings rather than code changes
              in this application.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

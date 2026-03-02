import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Data Deletion | Scheduled Publishing",
  description: "Data deletion information for Scheduled Publishing"
};

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Data Deletion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">What you can delete from the app</h2>
            <p>You can remove saved Pinterest connections, delete flows, delete queued content, and disconnect third-party services directly from the application interface.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Connected integrations</h2>
            <p>
              Disconnecting an integration removes the stored encrypted connection record from the application database. This prevents the app from using that integration
              for future actions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Generated and queued content</h2>
            <p>
              Flows, topic suggestions, queue items, and their related logs can be removed through the application. Previously published content on third-party platforms
              may still remain on those platforms and must be removed there separately if needed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Requesting full removal</h2>
            <p>
              If you need broader account-level cleanup for the current deployment, use the support channel associated with the service environment and include the account
              email used to sign in.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

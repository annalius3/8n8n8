import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Terms of Service | Autoposting Flow",
  description: "Terms of Service for Autoposting Flow"
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Service scope</h2>
            <p>
              Autoposting Flow provides tools for planning content, generating text and images, managing publishing queues, and sending content to connected platforms.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">User responsibility</h2>
            <p>
              You are responsible for the content you create, schedule, generate, and publish through the service. You must have the necessary rights to use any topics,
              text, images, links, or third-party accounts connected to the application.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Third-party services</h2>
            <p>
              The service relies on third-party providers such as Google, Pinterest, OpenAI, and Leonardo. Availability, API behavior, limits, and pricing of those
              services are outside the direct control of this application.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Acceptable use</h2>
            <p>
              You must not use the service for unlawful, deceptive, infringing, or abusive publishing. You must also comply with the terms and policies of every connected
              third-party platform.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">No guarantee</h2>
            <p>
              The service is provided as available. Execution logs, schedules, and integrations are designed to improve reliability, but uninterrupted operation and
              third-party delivery cannot be guaranteed.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

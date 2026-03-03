import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Privacy Policy | Autoposting Flow",
  description: "Privacy policy for Autoposting Flow"
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Overview</h2>
            <p>
              Autoposting Flow helps users plan content, generate assets, connect third-party services, and publish content on schedule.
              This policy explains what information the service stores and how that information is used.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Information we store</h2>
            <p>We may store account information such as your email address, basic profile details, publishing settings, run logs, queued content, and connected integration metadata.</p>
            <p>
              Sensitive secrets such as API tokens are stored only on the server and are encrypted before being written to the database.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">How connected services are used</h2>
            <p>
              When you connect services such as Pinterest, Google, OpenAI, or Leonardo, the application uses those credentials only to authenticate your account,
              generate content, retrieve boards, or publish content that you explicitly requested.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Use of generated content and logs</h2>
            <p>
              The application stores queue items, generated text, generated image references, scheduling data, and execution logs so that you can manage, retry, audit,
              and review publishing actions.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Data sharing</h2>
            <p>
              The service does not sell personal data. Data is shared only with the external providers required to fulfill requested features, such as authentication,
              image generation, text generation, and publishing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Data deletion</h2>
            <p>
              You can disconnect integrations, delete flows, and remove queued content from the application. Deleting connected integrations removes the stored encrypted
              connection record from the application database.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">Contact</h2>
            <p>
              For privacy-related questions, use the contact channel associated with the service deployment or the project owner responsible for the current environment.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

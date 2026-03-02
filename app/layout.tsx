import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";

export const metadata = {
  title: "Scheduled Publishing",
  description: "Visual MVP for scheduled publishing workflows"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <div className="container-page space-y-6">
          <header className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Scheduled Publishing</h1>
                <p className="text-sm text-muted-foreground">Plan content, prepare assets, and publish on schedule.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {user ? (
                  <div className="flex items-center gap-2">
                    <Badge>Signed in</Badge>
                    <span className="text-sm text-muted-foreground">{user.email}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">Sign-in required</Badge>
                    <span className="text-sm text-muted-foreground">Sign in to manage flows and connections</span>
                  </div>
                )}
                <nav className="flex items-center gap-2">
                  <LinkButton href="/flows" variant="outline">Flows</LinkButton>
                  <LinkButton href="/connections" variant="outline">Connections</LinkButton>
                  <LinkButton href="/settings" variant="outline">Settings</LinkButton>
                  <LinkButton href="/runs" variant="outline">Runs</LinkButton>
                  {user ? (
                    <form action="/api/auth/logout" method="post">
                      <Button type="submit" variant="secondary">
                        Sign out
                      </Button>
                    </form>
                  ) : (
                    <LinkButton href="/login">Sign in with magic link</LinkButton>
                  )}
                </nav>
              </div>
            </div>
          </header>
          {children}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
            <span>Scheduled Publishing</span>
            <nav className="flex items-center gap-3">
              <a className="underline underline-offset-4" href="/privacy">Privacy Policy</a>
              <a className="underline underline-offset-4" href="/terms">Terms of Service</a>
              <a className="underline underline-offset-4" href="/support">Support</a>
              <a className="underline underline-offset-4" href="/data-deletion">Data Deletion</a>
            </nav>
          </footer>
        </div>
      </body>
    </html>
  );
}

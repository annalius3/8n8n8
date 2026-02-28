import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Autoposting Flow",
  description: "Simplified n8n-like autoposting app"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <div className="container-page space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold">Autoposting Flow</h1>
              <p className="text-sm text-muted-foreground">Flow-based autoposting MVP</p>
            </div>
            <nav className="flex items-center gap-2">
              <Link href="/flows">
                <Button variant="outline">Flows</Button>
              </Link>
              <Link href="/runs">
                <Button variant="outline">Runs</Button>
              </Link>
              {user ? (
                <form action="/api/auth/logout" method="post">
                  <Button type="submit" variant="secondary">
                    Logout
                  </Button>
                </form>
              ) : (
                <Link href="/login">
                  <Button>Login</Button>
                </Link>
              )}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

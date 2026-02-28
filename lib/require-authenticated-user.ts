import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

function buildLoginRedirect(nextPath: string) {
  const params = new URLSearchParams({ next: nextPath });
  return `/login?${params.toString()}`;
}

export async function requireAuthenticatedUser(nextPath = "/connections") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(buildLoginRedirect(nextPath));
  }

  return user;
}

export async function getAuthenticatedUserOrNull() {
  return getCurrentUser();
}

import { requireAuthenticatedUser } from "@/lib/require-authenticated-user";

export async function requireUser(nextPath = "/flows") {
  return requireAuthenticatedUser(nextPath);
}

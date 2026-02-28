import { getActiveUser } from "@/lib/active-user";

export async function requireUser() {
  return getActiveUser();
}

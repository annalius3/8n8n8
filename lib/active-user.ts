import { getCurrentUser } from "@/lib/auth";

export async function getActiveUser() {
  return getCurrentUser();
}

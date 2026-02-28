import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const DEMO_USER_EMAIL = "demo@autoposting.local";

export async function ensureDemoUser() {
  return prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: "Демо пользователь"
    }
  });
}

export async function getActiveUser() {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    return currentUser;
  }

  return ensureDemoUser();
}

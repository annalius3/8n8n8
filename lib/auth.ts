import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const AUTH_COOKIE = "autoposting_session";

function authSecret(): string {
  return getServerEnv().AUTH_SECRET;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", authSecret()).update(payload).digest("hex");
}

export function createSignedStateToken(payload: Record<string, unknown>, expiresInMinutes = 15): string {
  const encodedPayload = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + expiresInMinutes * 60_000
    })
  ).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySignedStateToken<T extends Record<string, unknown>>(token: string): (T & { exp: number }) | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T & { exp: number };
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createMagicToken(email: string, expiresInMinutes = 20): string {
  const expiresAt = Date.now() + expiresInMinutes * 60_000;
  const payload = Buffer.from(JSON.stringify({ email, exp: expiresAt })).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyMagicToken(token: string): { email: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;

  let parsed: { email: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email: string;
      exp: number;
    };
  } catch {
    return null;
  }

  if (!parsed.email || Date.now() > parsed.exp) return null;
  return { email: parsed.email };
}

function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString(
    "base64url"
  );
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function readSessionToken(token: string): { userId: string } | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;

  let parsed: { userId: string; exp: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; exp: number };
  } catch {
    return null;
  }
  if (!parsed.userId || Date.now() > parsed.exp) return null;

  return { userId: parsed.userId };
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const session = readSessionToken(token);
  if (!session) return null;

  return prisma.user.findUnique({ where: { id: session.userId } });
}

export function setAuthCookie(response: NextResponse, userId: string) {
  response.cookies.set(AUTH_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: getServerEnv().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/"
  });
}

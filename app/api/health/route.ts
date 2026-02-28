import { NextResponse } from "next/server";
import { getIntegrationStatus, inspectServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const envCheck = inspectServerEnv();
  const envOk = envCheck.success;

  let databaseOk = false;
  let databaseError: string | null = null;

  try {
    await prisma.user.count();
    databaseOk = true;
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database check failed";
  }

  const payload = {
    ok: envOk && databaseOk,
    app: "autoposting-flow",
    timestamp: new Date().toISOString(),
    checks: {
      env: envOk
        ? { ok: true }
        : {
            ok: false,
            errors: envCheck.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message
            }))
          },
      database: databaseOk ? { ok: true } : { ok: false, error: databaseError }
    },
    integrations: getIntegrationStatus()
  };

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
}

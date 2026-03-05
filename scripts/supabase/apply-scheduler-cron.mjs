import { PrismaClient } from "@prisma/client";

const appUrl = (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
const schedulerToken = (process.env.SCHEDULER_TOKEN || "").trim();

function withPgbouncerFlag(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname.includes("pooler.supabase.com") && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return urlString;
  }
}

const datasourceUrl = withPgbouncerFlag(process.env.DATABASE_URL || "");
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: datasourceUrl
    }
  }
});

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

if (!appUrl) {
  console.error("APP_BASE_URL (or NEXT_PUBLIC_BASE_URL) is required");
  process.exit(1);
}

if (!schedulerToken) {
  console.error("SCHEDULER_TOKEN is required");
  process.exit(1);
}

const schedulerUrl = `${appUrl}/api/scheduler/tick`;

async function main() {
  await prisma.$executeRawUnsafe(`create extension if not exists pg_cron;`);
  await prisma.$executeRawUnsafe(`create extension if not exists pg_net;`);

  await prisma.$executeRawUnsafe(`
do $$
declare
  v_jobid integer;
begin
  select jobid into v_jobid
  from cron.job
  where jobname = 'autoposting_scheduler_tick'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;
  `);

  await prisma.$queryRawUnsafe(
    `
select cron.schedule(
  'autoposting_scheduler_tick',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := $1,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scheduler-token', $2
      ),
      body := '{}'::jsonb
    );
  $$
);
    `,
    schedulerUrl,
    schedulerToken
  );

  const jobs = await prisma.$queryRawUnsafe(
    `
select jobid, jobname, schedule, active
from cron.job
where jobname = 'autoposting_scheduler_tick';
    `
  );

  console.log("Supabase scheduler cron configured successfully.");
  console.log(
    JSON.stringify(
      jobs,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2
    )
  );
}

main()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to configure Supabase scheduler cron: ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

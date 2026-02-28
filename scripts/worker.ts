import { runSchedulerTick } from "../lib/worker/scheduler";

async function tick() {
  const result = await runSchedulerTick();
  const now = new Date().toISOString();
  console.log(`[${now}] scheduler started ${result.started}`);
}

async function main() {
  await tick();

  setInterval(() => {
    tick().catch((error) => {
      console.error("scheduler tick failed", error);
    });
  }, 60_000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

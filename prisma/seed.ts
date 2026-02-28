import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { encryptToken } from "../lib/crypto";
import { computeNextRunAt } from "../lib/worker/cron";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@autoposting.local" },
    update: {},
    create: {
      email: "demo@autoposting.local",
      name: "Demo"
    }
  });

  await prisma.connection.upsert({
    where: { id: "seed-connection-pinterest" },
    update: {
      userId: user.id,
      provider: "pinterest",
      name: "My Pinterest",
      encryptedJson: encryptToken(JSON.stringify({ access_token: "demo_token" }))
    },
    create: {
      id: "seed-connection-pinterest",
      userId: user.id,
      provider: "pinterest",
      name: "My Pinterest",
      encryptedJson: encryptToken(JSON.stringify({ access_token: "demo_token" }))
    }
  });

  await prisma.postQueueItem.deleteMany({ where: { userId: user.id } });
  await prisma.publishedItem.deleteMany({});

  await prisma.postQueueItem.createMany({
    data: [
      {
        userId: user.id,
        title: "Queue sample post #1",
        body: "This is a queued post body.",
        linkUrl: "https://example.com/q1",
        imagePrompt: "cozy lifestyle photo"
      },
      {
        userId: user.id,
        title: "Queue sample post #2",
        body: "Second queued post.",
        linkUrl: "https://example.com/q2",
        imagePrompt: "minimalist visual"
      }
    ]
  });

  const flow = await prisma.flow.upsert({
    where: { id: "seed-flow-rss-pinterest" },
    update: {
      userId: user.id,
      name: "RSS -> AI text -> Leonardo -> Pinterest",
      isEnabled: true
    },
    create: {
      id: "seed-flow-rss-pinterest",
      userId: user.id,
      name: "RSS -> AI text -> Leonardo -> Pinterest",
      isEnabled: true
    }
  });

  await prisma.flowStep.deleteMany({ where: { flowId: flow.id } });

  const steps: Prisma.FlowStepCreateManyInput[] = [
    {
      flowId: flow.id,
      orderIndex: 0,
      type: "schedule",
      configJson: { cron: "0 */6 * * *", timezone: "Europe/Kiev", max_runs_per_day: 10 }
    },
    {
      flowId: flow.id,
      orderIndex: 1,
      type: "rss",
      configJson: {
        rss_url: "https://hnrss.org/frontpage",
        take: 1,
        dedupe: { enabled: true, uid_field: "guid_or_link", platform: "pinterest" },
        mapping: { title: "title", summary: "contentSnippet", link_url: "link" }
      }
    },
    {
      flowId: flow.id,
      orderIndex: 2,
      type: "template",
      configJson: {
        pin_title_template: "{title} - quick guide",
        pin_description_template: "Read more: {link_url}\n\n{summary}\n\n{hashtags}",
        hashtags: ["#energy", "#healing", "#mindfulness"],
        max_title_len: 100,
        max_desc_len: 500
      }
    },
    {
      flowId: flow.id,
      orderIndex: 3,
      type: "ai_image_leonardo",
      configJson: {
        prompt_template: "Minimal cozy aesthetic photo representing: {title}. Soft light, high quality, no text, no watermark.",
        negative_prompt: "text, watermark, logo, blurry, low quality",
        width: 1024,
        height: 1024,
        steps: 30,
        guidance_scale: 7,
        num_images: 1,
        timeout_seconds: 120,
        store: { enabled: false, provider: "cloudflare_r2", path_template: "leonardo/{date}/{flow_id}/{uid}.jpg" }
      }
    },
    {
      flowId: flow.id,
      orderIndex: 4,
      type: "pinterest_publish",
      configJson: {
        connection_name: "My Pinterest",
        board_id: "1234567890",
        title_from: "context.text.pin_title",
        description_from: "context.text.pin_description",
        link_url_from: "context.source.link_url",
        image_url_from: "context.image.image_url",
        alt_text_template: "{title}",
        dedupe: { write_published_item: true, platform: "pinterest", source_uid_from: "context.source.uid" }
      }
    }
  ];

  await prisma.flowStep.createMany({ data: steps });

  await prisma.flowSchedule.upsert({
    where: { flowId: flow.id },
    update: {
      cron: "0 */6 * * *",
      timezone: "Europe/Kiev",
      maxRunsPerDay: 10,
      nextRunAt: computeNextRunAt("0 */6 * * *", "Europe/Kiev")
    },
    create: {
      flowId: flow.id,
      cron: "0 */6 * * *",
      timezone: "Europe/Kiev",
      maxRunsPerDay: 10,
      nextRunAt: computeNextRunAt("0 */6 * * *", "Europe/Kiev")
    }
  });

  console.log("Seeded demo data for demo@autoposting.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

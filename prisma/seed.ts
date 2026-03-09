import { prisma } from "../lib/prisma";
import { encryptToken } from "../lib/crypto";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "owner@autoposting.local" },
    update: {},
    create: {
      email: "owner@autoposting.local",
      name: "Owner"
    }
  });

  await prisma.connection.upsert({
    where: { id: "seed-connection-pinterest" },
    update: {
      userId: user.id,
      provider: "pinterest",
      name: "Основной Pinterest",
      encryptedJson: encryptToken(JSON.stringify({ accessToken: "seed_invalid_token_replace_me" }))
    },
    create: {
      id: "seed-connection-pinterest",
      userId: user.id,
      provider: "pinterest",
      name: "Основной Pinterest",
      encryptedJson: encryptToken(JSON.stringify({ accessToken: "seed_invalid_token_replace_me" }))
    }
  });

  await prisma.jobRunStep.deleteMany({});
  await prisma.jobRun.deleteMany({});
  await prisma.postQueueItem.deleteMany({ where: { userId: user.id } });
  await prisma.topicSuggestion.deleteMany({});
  await prisma.flowSchedule.deleteMany({});
  await prisma.flowStep.deleteMany({});
  await prisma.flow.deleteMany({
    where: {
      userId: user.id,
      id: { in: ["seed-flow-rss-pinterest", "seed-flow-topic-campaign"] }
    }
  });
  await prisma.publishedItem.deleteMany({});

  const flow = await prisma.flow.create({
    data: {
      id: "seed-flow-topic-campaign",
      userId: user.id,
      name: "Темы для Pinterest по исходной теме",
      isEnabled: true,
      seedTopic: "calm morning routine for better energy",
      language: "RU",
      niche: "wellness",
      audience: "женщины 25-45",
      tone: "спокойный, полезный, уверенный",
      postsPerDay: 3,
      timezone: "Europe/Kiev",
      startTime: "09:00",
      autopublishEnabled: false
    }
  });

  await prisma.flowStep.createMany({
    data: [
      {
        flowId: flow.id,
        orderIndex: 0,
        type: "template",
        configJson: {
          provider: "openai",
          hashtags: ["#wellness", "#morningroutine"],
          max_title_len: 90,
          max_desc_len: 450
        }
      },
      {
        flowId: flow.id,
        orderIndex: 1,
        type: "ai_image_leonardo",
        configJson: {
          prompt_template:
            "Create a clean editorial blog cover image about {topic}. Main subject: {visual_subject}. Scene: {visual_scene}. Style: {visual_style}. Composition: {visual_composition}. Format: {visual_format}. Use relevant business details from: {description}. If useful, incorporate this product hint naturally: {image_prompt}. No text, no letters, no watermark, no logo, no collage, no extra objects.",
          negative_prompt: "text, watermark, logo, blurry, low quality",
          width: 1024,
          height: 1024,
          steps: 30,
          guidance_scale: 7,
          num_images: 1,
          timeout_seconds: 120
        }
      },
      {
        flowId: flow.id,
        orderIndex: 2,
        type: "pinterest_publish",
        configJson: {
          connection_name: "Основной Pinterest",
          board_id: "",
          title_from: "context.text.title",
          description_from: "context.text.description",
          image_url_from: "context.image.image_url",
          link_url_from: "context.queue.link_url",
          alt_text_template: "{topic}"
        }
      }
    ]
  });

  await prisma.flowSchedule.create({
    data: {
      flowId: flow.id,
      cron: "0 0 * * *",
      timezone: "Europe/Kiev",
      maxRunsPerDay: 3,
      nextRunAt: new Date(),
      isPaused: true
    }
  });

  await prisma.topicSuggestion.createMany({
    data: [
      "7 morning rituals for calm energy",
      "How to start your day without overwhelm",
      "Simple habits for a more grounded morning",
      "3-minute reset routine before work",
      "Gentle morning ideas for better focus"
    ].map((topicText) => ({
      flowId: flow.id,
      topicText
    }))
  });

  await prisma.postQueueItem.createMany({
    data: [
      {
        userId: user.id,
        flowId: flow.id,
        topicText: "7 morning rituals for calm energy",
        title: "7 morning rituals for calm energy",
        body: "",
        status: "pending"
      },
      {
        userId: user.id,
        flowId: flow.id,
        topicText: "How to start your day without overwhelm",
        title: "How to start your day without overwhelm",
        body: "",
        status: "pending"
      }
    ]
  });

  console.log("Seeded starter data for owner@autoposting.local");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

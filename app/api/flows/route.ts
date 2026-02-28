import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActiveUser } from "@/lib/active-user";
import { prisma } from "@/lib/prisma";
import { computeNextRunAt } from "@/lib/worker/cron";

const createSchema = z.object({
  name: z.string().min(2),
  sourceType: z.enum(["rss", "queue"]).default("rss"),
  cron: z.string().min(5),
  timezone: z.string().default("Europe/Kiev"),
  maxRunsPerDay: z.number().int().positive().default(10),
  rssUrl: z.string().url().optional(),
  textTemplate: z.string().min(3),
  imagePromptTemplate: z.string().min(3)
});

export async function GET() {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const flows = await prisma.flow.findMany({
    where: { userId: user.id },
    include: {
      schedule: true,
      steps: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return NextResponse.json(flows);
}

export async function POST(request: NextRequest) {
  const user = await getActiveUser();
  if (!user) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  const sourceStep =
    input.sourceType === "queue"
      ? {
          orderIndex: 1,
          type: "queue",
          configJson: {
            take: 1,
            lock_ttl_minutes: 30,
            only_status: ["pending"],
            mapping: {
              uid: "id",
              title: "title",
              summary: "body",
              link_url: "link_url",
              image_prompt: "image_prompt"
            }
          }
        }
      : {
          orderIndex: 1,
          type: "rss",
          configJson: {
            rss_url: input.rssUrl ?? "https://hnrss.org/frontpage",
            take: 1,
            dedupe: { enabled: true, uid_field: "guid_or_link", platform: "pinterest" },
            mapping: { title: "title", summary: "contentSnippet", link_url: "link" }
          }
        };

  const flow = await prisma.flow.create({
    data: {
      userId: user.id,
      name: input.name,
      isEnabled: true,
      steps: {
        create: [
          {
            orderIndex: 0,
            type: "schedule",
            configJson: {
              cron: input.cron,
              timezone: input.timezone,
              max_runs_per_day: input.maxRunsPerDay
            }
          },
          sourceStep,
          {
            orderIndex: 2,
            type: "template",
            configJson: {
              pin_title_template: "{title} - quick guide",
              pin_description_template: input.textTemplate,
              hashtags: ["#energy", "#healing", "#mindfulness"],
              max_title_len: 100,
              max_desc_len: 500
            }
          },
          {
            orderIndex: 3,
            type: "ai_image_leonardo",
            configJson: {
              prompt_template: input.imagePromptTemplate,
              negative_prompt: "text, watermark, logo, blurry, low quality",
              width: 1024,
              height: 1024,
              steps: 30,
              guidance_scale: 7,
              num_images: 1,
              timeout_seconds: 120,
              store: {
                enabled: false,
                provider: "cloudflare_r2",
                path_template: "leonardo/{date}/{flow_id}/{uid}.jpg"
              }
            }
          },
          {
            orderIndex: 4,
            type: "pinterest_publish",
            configJson: {
              connection_name: "Основной Pinterest",
              board_id: "1234567890",
              title_from: "context.text.pin_title",
              description_from: "context.text.pin_description",
              link_url_from: "context.source.link_url",
              image_url_from: "context.image.image_url",
              alt_text_template: "{title}",
              dedupe: {
                write_published_item: true,
                platform: "pinterest",
                source_uid_from: "context.source.uid"
              }
            }
          }
        ]
      },
      schedule: {
        create: {
          cron: input.cron,
          timezone: input.timezone,
          maxRunsPerDay: input.maxRunsPerDay,
          nextRunAt: computeNextRunAt(input.cron, input.timezone)
        }
      }
    },
    include: {
      schedule: true,
      steps: true
    }
  });

  return NextResponse.json(flow, { status: 201 });
}

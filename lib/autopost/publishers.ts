import type { SocialPlatform } from "@prisma/client";
import { publishToPinterest } from "@/lib/integrations/pinterest";
import { getServerEnv } from "@/lib/env";

export type PublisherInput = {
  userId: string;
  article: {
    id: string;
    title: string;
    canonicalUrl: string;
  };
  content: Record<string, any>;
};

export type PublisherResult =
  | { outcome: "published"; externalPostId: string; response?: Record<string, any> }
  | { outcome: "skipped"; reason: string; code: string }
  | { outcome: "failed"; reason: string; code: string };

async function publishTelegram(input: PublisherInput): Promise<PublisherResult> {
  const env = getServerEnv();
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return {
      outcome: "skipped",
      code: "TELEGRAM_NOT_CONFIGURED",
      reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing"
    };
  }

  const text = String(input.content.text ?? "").trim();
  if (!text) {
    return { outcome: "failed", code: "TELEGRAM_TEXT_MISSING", reason: "Telegram content is empty" };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      outcome: "failed",
      code: `TELEGRAM_API_${response.status}`,
      reason: `Telegram API error ${response.status}: ${body.slice(0, 280)}`
    };
  }

  const payload = (await response.json()) as { result?: { message_id?: number } };
  return {
    outcome: "published",
    externalPostId: String(payload.result?.message_id ?? `telegram-${Date.now()}`),
    response: payload as Record<string, any>
  };
}

async function publishPinterest(input: PublisherInput): Promise<PublisherResult> {
  const boardId = getServerEnv().PINTEREST_BOARD_ID;
  const imageUrl = String(input.content.imageUrl ?? "").trim();
  if (!imageUrl) {
    return {
      outcome: "skipped",
      code: "PINTEREST_IMAGE_REQUIRED",
      reason: "Pinterest publish requires imageUrl. Save generated image first."
    };
  }

  try {
    const result = await publishToPinterest({
      userId: input.userId,
      boardId,
      title: String(input.content.pinTitle ?? input.article.title).slice(0, 100),
      description: String(input.content.pinDescription ?? "").slice(0, 500),
      linkUrl: input.article.canonicalUrl,
      imageUrl
    });

    return {
      outcome: "published",
      externalPostId: result.postId,
      response: { mode: result.mode }
    };
  } catch (error) {
    return {
      outcome: "failed",
      code: "PINTEREST_PUBLISH_FAILED",
      reason: error instanceof Error ? error.message : "Pinterest publish failed"
    };
  }
}

async function publishStub(platform: SocialPlatform): Promise<PublisherResult> {
  return {
    outcome: "skipped",
    code: `${platform.toUpperCase()}_NOT_IMPLEMENTED`,
    reason: `${platform} publishing adapter is not configured yet`
  };
}

export async function publishByPlatform(platform: SocialPlatform, input: PublisherInput): Promise<PublisherResult> {
  if (platform === "telegram") {
    return publishTelegram(input);
  }

  if (platform === "pinterest") {
    return publishPinterest(input);
  }

  return publishStub(platform);
}

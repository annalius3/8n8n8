import { getServerEnv } from "@/lib/env";

function escapeTelegramHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramPublishNotification(input: {
  flowName: string;
  title: string;
  postId: string;
  linkUrl?: string | null;
}) {
  const env = getServerEnv();
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new Error("Telegram notifications are not configured");
  }

  const lines = [
    "<b>Публикация выполнена</b>",
    `Поток: ${escapeTelegramHtml(input.flowName)}`,
    `Заголовок: ${escapeTelegramHtml(input.title)}`,
    `Pinterest Post ID: ${escapeTelegramHtml(input.postId)}`
  ];

  if (input.linkUrl) {
    lines.push(`Ссылка: ${escapeTelegramHtml(input.linkUrl)}`);
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: lines.join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: false
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram send failed: ${response.status} ${body.slice(0, 300)}`);
  }
}

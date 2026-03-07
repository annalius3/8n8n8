import { prisma } from "@/lib/prisma";
import { DEFAULT_RSS_URL } from "@/lib/autopost/constants";

export type ExtractedArticleCandidate = {
  sourceType: "rss";
  sourceUid: string;
  canonicalUrl: string;
  title: string;
  category?: string | null;
  excerpt?: string | null;
  content: string;
  publishedAt: Date;
};

function stripCdata(value: string) {
  return value.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItemDate(raw: string | undefined) {
  if (!raw) return new Date();
  const parsed = new Date(stripCdata(raw));
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

async function fetchArticleContent(linkUrl: string) {
  try {
    const response = await fetch(linkUrl, { cache: "no-store" });
    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const articleMatch =
      html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i) ??
      html.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i) ??
      html.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);

    return stripHtml(articleMatch?.[1] ?? html).slice(0, 20_000);
  } catch {
    return "";
  }
}

function parseRssItems(xml: string) {
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));
  return items
    .map((itemMatch) => {
      const itemXml = itemMatch[1];
      const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
      const description = itemXml.match(/<description>([\s\S]*?)<\/description>/i)?.[1];
      const contentEncoded = itemXml.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1];
      const category = itemXml.match(/<category[^>]*>([\s\S]*?)<\/category>/i)?.[1];
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];

      const canonicalUrl = stripCdata(link ?? "");
      const sourceUid = stripCdata(guid ?? canonicalUrl ?? title ?? "");
      if (!sourceUid || !canonicalUrl) {
        return null;
      }

      const safeTitle = stripCdata(title ?? "Untitled");
      const excerpt = stripHtml(stripCdata(description ?? "")).slice(0, 700);
      const content = stripHtml(stripCdata(contentEncoded ?? description ?? "")).slice(0, 12_000);

      return {
        sourceType: "rss" as const,
        sourceUid,
        canonicalUrl,
        title: safeTitle,
        category: category ? stripCdata(category) : null,
        excerpt,
        content,
        publishedAt: parseItemDate(pubDate)
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export async function ensureArticleSourceConfig(userId: string) {
  const existing = await prisma.articleSourceConfig.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" }
  });

  if (existing) {
    return existing;
  }

  return prisma.articleSourceConfig.create({
    data: {
      userId,
      sourceType: "rss",
      rssUrl: DEFAULT_RSS_URL,
      enabled: true,
      immediatePublishEnabled: true,
      assetsPersistenceEnabled: true
    }
  });
}

export async function scanNewArticlesForUser(userId: string) {
  const config = await ensureArticleSourceConfig(userId);
  if (!config.enabled || !config.rssUrl) {
    return { created: 0, scanned: 0 };
  }

  const response = await fetch(config.rssUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parseRssItems(xml).slice(0, 30);

  const existing = await prisma.article.findMany({
    where: {
      userId,
      sourceType: "rss",
      sourceUid: { in: parsed.map((item) => item.sourceUid) }
    },
    select: { sourceUid: true }
  });
  const existingSet = new Set(existing.map((item) => item.sourceUid));

  const newItems = parsed.filter((item) => !existingSet.has(item.sourceUid));
  const enriched: ExtractedArticleCandidate[] = [];
  for (const item of newItems) {
    const content = item.content || (await fetchArticleContent(item.canonicalUrl));
    enriched.push({
      ...item,
      content: content || item.excerpt || item.title
    });
  }

  if (enriched.length > 0) {
    await prisma.article.createMany({
      data: enriched.map((item) => ({
        userId,
        sourceType: item.sourceType,
        sourceUid: item.sourceUid,
        canonicalUrl: item.canonicalUrl,
        title: item.title,
        category: item.category,
        excerpt: item.excerpt,
        content: item.content,
        publishedAt: item.publishedAt,
        autopostEnabled: true
      }))
    });
  }

  await prisma.articleSourceConfig.update({
    where: { id: config.id },
    data: { lastScannedAt: new Date() }
  });

  return {
    created: enriched.length,
    scanned: parsed.length
  };
}

export type RssItem = {
  uid: string;
  title: string;
  body: string;
  linkUrl?: string;
};

function stripCdata(value: string) {
  return value.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
}

export async function fetchRssItems(url: string): Promise<RssItem[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  const matches = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  const items = matches
    .map((match) => {
      const itemXml = match[1];
      const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "Untitled";
      const description = itemXml.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";

      const uid = stripCdata(guid ?? link ?? title);
      if (!uid) return null;

      return {
        uid,
        title: stripCdata(title),
        body: stripCdata(description),
        ...(link ? { linkUrl: stripCdata(link) } : {})
      };
    })
    .filter((item): item is RssItem => item !== null);

  return items;
}

import type { SocialPlatform } from "@prisma/client";

export const AUTOPOST_SYSTEM_FLOW_NAME = "__AUTOPOST_SYSTEM__";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "twitter",
  "linkedin",
  "reddit",
  "telegram",
  "pinterest",
  "medium",
  "facebook"
];

export const DEFAULT_RSS_URL = "https://www.b2bleadgenerationtools.com/feed.xml";

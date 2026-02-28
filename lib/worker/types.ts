export type RunnerContext = {
  source?: {
    type: "rss" | "queue";
    uid: string;
    title?: string;
    summary?: string;
    link_url?: string;
    image_prompt?: string;
  };
  text?: {
    pin_title: string;
    pin_description: string;
    hashtags: string[];
  };
  image?: {
    prompt: string;
    image_url: string;
  };
  publish?: {
    platform: "pinterest";
    board_id?: string;
    post_id: string;
  };
};

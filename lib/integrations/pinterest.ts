import { decryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export type PinterestPublishPayload = {
  userId: string;
  connectionName?: string;
  boardId?: string;
  title: string;
  description: string;
  linkUrl?: string;
  imageUrl?: string;
  altText?: string;
};

export type PinterestPublishResult = {
  postId: string;
};

export async function publishToPinterest(payload: PinterestPublishPayload): Promise<PinterestPublishResult> {
  const connection = await prisma.connection.findFirst({
    where: {
      userId: payload.userId,
      provider: "pinterest",
      ...(payload.connectionName ? { name: payload.connectionName } : {})
    }
  });

  if (connection) {
    decryptToken(connection.encryptedJson);
  }

  return {
    postId: `pin_${Date.now()}`
  };
}

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
  mode: "real";
};

type PinterestConnectionSecret = {
  accessToken: string;
  updatedAt?: string;
};

type PinterestBoard = {
  id: string;
  name: string;
  privacy?: string;
};

type ListPinterestBoardsInput = {
  userId: string;
  connectionName?: string;
};

function withPinterestCode(code: string, message: string) {
  return `[${code}] ${message}`;
}

async function findPinterestConnection(userId: string, connectionName?: string) {
  return prisma.connection.findFirst({
    where: {
      userId,
      provider: "pinterest",
      ...(connectionName ? { name: connectionName } : {})
    }
  });
}

function parsePinterestSecret(encryptedJson: string): PinterestConnectionSecret {
  const parsed = JSON.parse(decryptToken(encryptedJson)) as PinterestConnectionSecret;
  if (!parsed.accessToken) {
    throw new Error(withPinterestCode("PINTEREST_ACCESS_TOKEN_MISSING", "Pinterest connection is missing access token"));
  }

  return parsed;
}

async function pinterestFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.pinterest.com/v5${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(withPinterestCode(`PINTEREST_API_${response.status}`, `Pinterest API error ${response.status}: ${errorText.slice(0, 300)}`));
  }

  return (await response.json()) as T;
}

export async function listPinterestBoards(input: ListPinterestBoardsInput): Promise<PinterestBoard[]> {
  const connection = await findPinterestConnection(input.userId, input.connectionName);
  if (!connection) {
    throw new Error(withPinterestCode("PINTEREST_CONNECTION_MISSING", "Save a Pinterest token on the Connections page first"));
  }

  const secret = parsePinterestSecret(connection.encryptedJson);
  const data = await pinterestFetch<{ items?: Array<{ id?: string; name?: string; privacy?: string }> }>(
    "/boards?page_size=100",
    secret.accessToken
  );

  return (data.items ?? [])
    .filter((board) => board.id && board.name)
    .map((board) => ({
      id: String(board.id),
      name: String(board.name),
      privacy: board.privacy ? String(board.privacy) : undefined
    }));
}

export async function publishToPinterest(payload: PinterestPublishPayload): Promise<PinterestPublishResult> {
  const connection = await findPinterestConnection(payload.userId, payload.connectionName);
  if (!connection) {
    throw new Error(withPinterestCode("PINTEREST_CONNECTION_NOT_CONFIGURED", "Pinterest connection is not configured"));
  }

  const secret = parsePinterestSecret(connection.encryptedJson);
  let boardId = payload.boardId;

  if (!boardId) {
    const boards = await listPinterestBoards({
      userId: payload.userId,
      connectionName: payload.connectionName
    });

    if (boards.length === 1) {
      boardId = boards[0].id;
    } else {
      throw new Error(withPinterestCode("PINTEREST_BOARD_ID_MISSING", "Pinterest connection exists, but board_id is not configured"));
    }
  }

  if (!payload.imageUrl) {
    throw new Error(withPinterestCode("PINTEREST_IMAGE_URL_MISSING", "Pinterest publish requires image_url for real API mode"));
  }

  const data = await pinterestFetch<{ id?: string }>("/pins", secret.accessToken, {
    method: "POST",
    body: JSON.stringify({
      board_id: boardId,
      title: payload.title,
      description: payload.description,
      link: payload.linkUrl,
      alt_text: payload.altText,
      media_source: {
        source_type: "image_url",
        url: payload.imageUrl
      }
    })
  });

  if (!data.id) {
    throw new Error(withPinterestCode("PINTEREST_PIN_ID_MISSING", "Pinterest API did not return pin id"));
  }

  return {
    postId: String(data.id),
    mode: "real"
  };
}



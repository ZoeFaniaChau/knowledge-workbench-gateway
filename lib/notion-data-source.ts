const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION =
  process.env.NOTION_API_VERSION ?? "2026-03-11";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }

  return value;
}

async function notionFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = requireEnv("NOTION_API_TOKEN");

  const response = await fetch(NOTION_API_BASE + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      "Notion API " +
        response.status +
        ": " +
        (await response.text()),
    );
  }

  return (await response.json()) as T;
}

export type NotionPageProperty = {
  type?: string;
  title?: Array<{
    plain_text?: string;
    text?: {
      content?: string;
    };
  }>;
  rich_text?: Array<{
    plain_text?: string;
    text?: {
      content?: string;
    };
  }>;
  select?: {
    name?: string;
  } | null;
  multi_select?: Array<{
    name?: string;
  }>;
};

export type NotionPage = {
  id: string;
  properties?: Record<string, NotionPageProperty>;
};

type NotionDataSourceQueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

export async function queryNotionDataSource(
  dataSourceId: string,
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];

  let startCursor: string | undefined;

  do {
    const response = await notionFetch<NotionDataSourceQueryResponse>(
      "/data_sources/" +
        encodeURIComponent(dataSourceId) +
        "/query",
      {
        method: "POST",
        body: JSON.stringify({
          page_size: 100,
          ...(startCursor
            ? { start_cursor: startCursor }
            : {}),
        }),
      },
    );

    pages.push(...response.results);

    startCursor =
      response.has_more && response.next_cursor
        ? response.next_cursor
        : undefined;
  } while (startCursor);

  return pages;
}

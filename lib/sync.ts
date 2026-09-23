const NOTION_API_BASE = "https://api.notion.com/v1";
const GITHUB_API_BASE = "https://api.github.com";
const NOTION_VERSION = process.env.NOTION_API_VERSION ?? "2026-03-11";
const GITHUB_REPOSITORY =
  process.env.GITHUB_REPOSITORY ?? "ZoeFaniaChau/knowledge-workbench";

type NotionRichText = {
  type: string;
  plain_text?: string;
  text?: { content?: string; link?: { url?: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
};

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function notionFetch<T>(path: string): Promise<T> {
  const token = requireEnv("NOTION_API_TOKEN");
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Notion API ${response.status}: ${detail}`);
  }

  return (await response.json()) as T;
}

async function getPage(pageId: string) {
  return notionFetch<{
    id: string;
    properties?: Record<string, {
      type?: string;
      title?: NotionRichText[];
      rich_text?: NotionRichText[];
    }>;
  }>(`/pages/${pageId}`);
}

async function getBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const query = cursor
      ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}`
      : "?page_size=100";

    const response = await notionFetch<{
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`/blocks/${blockId}/children${query}`);

    blocks.push(...response.results);
    cursor = response.has_more && response.next_cursor
      ? response.next_cursor
      : undefined;
  } while (cursor);

  return blocks;
}

function escapeMarkdown(text: string): string {
  return text.replace(/\\/g, "\\\\");
}

function richTextToMarkdown(items: NotionRichText[] = []): string {
  return items
    .map((item) => {
      let text = item.plain_text ?? item.text?.content ?? "";
      text = escapeMarkdown(text);

      const link = item.text?.link?.url;
      if (link) {
        text = `[${text}](${link})`;
      }

      if (item.annotations?.code) text = `\`${text}\``;
      if (item.annotations?.bold) text = `**${text}**`;
      if (item.annotations?.italic) text = `*${text}*`;
      if (item.annotations?.strikethrough) text = `~~${text}~~`;

      return text;
    })
    .join("");
}

function blockText(block: NotionBlock): string {
  const data = block[block.type] as
    | { rich_text?: NotionRichText[]; caption?: NotionRichText[] }
    | undefined;

  return richTextToMarkdown(data?.rich_text);
}

function blockToMarkdown(block: NotionBlock, depth = 0): string {
  const text = blockText(block);
  const indent = "  ".repeat(depth);

  switch (block.type) {
    case "paragraph":
      return text;

    case "heading_1":
      return `# ${text}`;

    case "heading_2":
      return `## ${text}`;

    case "heading_3":
      return `### ${text}`;

    case "bulleted_list_item":
      return `${indent}- ${text}`;

    case "numbered_list_item":
      return `${indent}1. ${text}`;

    case "to_do": {
      const data = block.to_do as { checked?: boolean } | undefined;
      return `${indent}- [${data?.checked ? "x" : " "}] ${text}`;
    }

    case "quote":
      return text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");

    case "callout":
      return `> ${text}`;

    case "code": {
      const data = block.code as {
        language?: string;
        rich_text?: NotionRichText[];
      };
      const code = richTextToMarkdown(data.rich_text);
      return \`\`\`\${data.language ?? ""}\n\${code}\n\`\`\`;
    }

    case "divider":
      return "---";

    case "bookmark":
    case "embed":
      return text;

    default:
      return text;
  }
}

async function renderBlocks(
  blocks: NotionBlock[],
  depth = 0,
): Promise<string> {
  const parts: string[] = [];

  for (const block of blocks) {
    const rendered = blockToMarkdown(block, depth);

    if (rendered.trim()) {
      parts.push(rendered);
    }

    if (block.has_children) {
      const children = await getBlockChildren(block.id);
      const childMarkdown = await renderBlocks(children, depth + 1);
      if (childMarkdown.trim()) {
        parts.push(childMarkdown);
      }
    }
  }

  return parts.join("\n\n");
}

function getPageTitle(page: Awaited<ReturnType<typeof getPage>>): string {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === "title" && property.title) {
      return richTextToMarkdown(property.title);
    }
  }

  return "Untitled";
}

async function getManifestEntry(pageId: string): Promise<{
  title: string;
  kind: string;
  path: string;
} | null> {
  const response = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/main/sync/manifest.json`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    throw new Error(`Manifest fetch failed: ${response.status}`);
  }

  const manifest = (await response.json()) as {
    objects?: Record<string, { title: string; kind: string; path: string }>;
  };

  return manifest.objects?.[pageId] ?? null;
}

async function githubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = requireEnv("GITHUB_TOKEN");

  return fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
}

async function writeGithubFile(path: string, content: string, message: string) {
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const existing = await githubFetch(
    `/repos/${GITHUB_REPOSITORY}/contents/${encodedPath}?ref=main`,
  );

  let sha: string | undefined;

  if (existing.ok) {
    const data = (await existing.json()) as { sha?: string };
    sha = data.sha;
  } else if (existing.status !== 404) {
    throw new Error(
      `GitHub read ${existing.status}: ${await existing.text()}`,
    );
  }

  const response = await githubFetch(
    `/repos/${GITHUB_REPOSITORY}/contents/${encodedPath}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch: "main",
        ...(sha ? { sha } : {}),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `GitHub write ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as {
    content?: { path?: string; sha?: string };
    commit?: { sha?: string };
  };
}

export async function syncNotionPage(pageId: string) {
  const manifestEntry = await getManifestEntry(pageId);

  if (!manifestEntry) {
    return {
      synced: false,
      reason: "page_not_in_manifest",
      pageId,
    };
  }

  const page = await getPage(pageId);
  const blocks = await getBlockChildren(pageId);
  const markdownBody = await renderBlocks(blocks);

  const title = getPageTitle(page);
  const markdown = `# ${title}\n\n${markdownBody.trim()}\n`;

  const result = await writeGithubFile(
    manifestEntry.path,
    markdown,
    `sync: update ${manifestEntry.path}`,
  );

  return {
    synced: true,
    pageId,
    title,
    path: manifestEntry.path,
    commitSha: result.commit?.sha,
    fileSha: result.content?.sha,
  };
}

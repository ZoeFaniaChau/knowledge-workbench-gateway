const NOTION_API_BASE = "https://api.notion.com/v1";
const GITHUB_API_BASE = "https://api.github.com";
const NOTION_VERSION = process.env.NOTION_API_VERSION ?? "2026-03-11";
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY ?? "ZoeFaniaChau/knowledge-workbench";

import {
  blockToMarkdown,
  richTextToMarkdown,
  type NotionBlock,
  type NotionRichText,
} from "@/lib/markdown";


function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}

async function notionFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  if (!response.ok) throw new Error("Notion API " + response.status + ": " + (await response.text()));
  return (await response.json()) as T;
}

type SyncStatus = "Pending" | "Synced" | "Error";

async function updateNotionSyncStatus(pageId: string, status: SyncStatus, syncedAt?: string) {
  const properties: Record<string, unknown> = {
    "GitHub Sync Status": {
      select: { name: status },
    },
  };

  if (status === "Synced") {
    properties["GitHub Last Synced"] = {
      date: { start: syncedAt ?? new Date().toISOString() },
    };
  }

  await notionFetch("/pages/" + pageId, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

async function getPage(pageId: string) {
  return notionFetch<{ id: string; properties?: Record<string, { type?: string; title?: NotionRichText[]; rich_text?: NotionRichText[] }> }>("/pages/" + pageId);
}

async function getBlockChildren(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const query = cursor ? "?page_size=100&start_cursor=" + encodeURIComponent(cursor) : "?page_size=100";
    const response = await notionFetch<{ results: NotionBlock[]; has_more: boolean; next_cursor: string | null }>("/blocks/" + blockId + "/children" + query);
    blocks.push(...response.results);
    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function renderBlocks(blocks: NotionBlock[], depth = 0): Promise<string> {
  const parts: string[] = [];
  for (const block of blocks) {
    const rendered = blockToMarkdown(block, depth);
    if (rendered.trim()) parts.push(rendered);
    if (block.has_children) {
      const childMarkdown = await renderBlocks(await getBlockChildren(block.id), depth + 1);
      if (childMarkdown.trim()) parts.push(childMarkdown);
    }
  }
  return parts.join("\n\n");
}

function getPageTitle(page: Awaited<ReturnType<typeof getPage>>): string {
  for (const property of Object.values(page.properties ?? {})) {
    if (property.type === "title" && property.title) return richTextToMarkdown(property.title);
  }
  return "Untitled";
}

async function getManifestEntry(pageId: string): Promise<{ title: string; kind: string; path: string } | null> {
  const response = await fetch("https://raw.githubusercontent.com/" + GITHUB_REPOSITORY + "/main/sync/manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Manifest fetch failed: " + response.status);
  const manifest = (await response.json()) as { objects?: Record<string, { title: string; kind: string; path: string }> };
  return manifest.objects?.[pageId] ?? null;
}

async function githubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = requireEnv("GITHUB_TOKEN");
  return fetch(GITHUB_API_BASE + path, { ...init, headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28", ...(init.headers ?? {}) } });
}

async function writeGithubFile(path: string, content: string, message: string) {
  const encodedPath = path.split("/").map((part) => encodeURIComponent(part)).join("/");
  const endpoint = "/repos/" + GITHUB_REPOSITORY + "/contents/" + encodedPath;
  const existing = await githubFetch(endpoint + "?ref=main");
  let sha: string | undefined;

  if (existing.ok) {
    const existingFile = (await existing.json()) as {
      sha?: string;
      content?: string;
      encoding?: string;
    };
    sha = existingFile.sha;

    if (existingFile.content && existingFile.encoding === "base64") {
      const existingContent = Buffer.from(existingFile.content.replace(/\n/g, ""), "base64").toString("utf8");
      if (existingContent === content) {
        return {
          skipped: true,
          content: { path, sha },
        };
      }
    }
  } else if (existing.status !== 404) {
    throw new Error("GitHub read " + existing.status + ": " + (await existing.text()));
  }

  const response = await githubFetch(endpoint, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: "main",
      ...(sha ? { sha } : {}),
    }),
  });

  if (!response.ok) throw new Error("GitHub write " + response.status + ": " + (await response.text()));
  return {
    skipped: false,
    ...(await response.json()) as {
      content?: { path?: string; sha?: string };
      commit?: { sha?: string };
    },
  };
}

export async function syncNotionPage(pageId: string) {
  try {
    const manifestEntry = await getManifestEntry(pageId);
    if (!manifestEntry) return { synced: false, reason: "page_not_in_manifest", pageId };

    await updateNotionSyncStatus(pageId, "Pending");

    const page = await getPage(pageId);
    const blocks = await getBlockChildren(pageId);
    const markdownBody = await renderBlocks(blocks);
    const title = getPageTitle(page);
    const markdown = "# " + title + "\n\n" + markdownBody.trim() + "\n";

    const result = await writeGithubFile(
      manifestEntry.path,
      markdown,
      "sync: update " + manifestEntry.path,
    );

    const syncedAt = new Date().toISOString();
    await updateNotionSyncStatus(pageId, "Synced", syncedAt);

    return {
      synced: true,
      skipped: result.skipped,
      pageId,
      title,
      path: manifestEntry.path,
      commitSha: result.commit?.sha,
      fileSha: result.content?.sha,
      syncedAt,
    };
  } catch (error) {
    try {
      await updateNotionSyncStatus(pageId, "Error");
    } catch (statusError) {
      console.error("Failed to update Notion sync error status:", statusError);
    }
    throw error;
  }
}

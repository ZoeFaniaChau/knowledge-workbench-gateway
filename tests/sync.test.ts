import assert from "node:assert/strict";
import test from "node:test";

import { syncNotionPage } from "../lib/sync.ts";

const PAGE_ID = "3e35b0a8-98a3-8096-aa3b-e575292670da";
const FILE_PATH = "knowledge/research/模块化不是拆分，而是让变化有边界.md";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function manifestResponse() {
  return jsonResponse({
    version: 1,
    objects: {
      [PAGE_ID]: {
        title: "模块化不是拆分，而是让变化有边界",
        kind: "Research",
        path: FILE_PATH,
      },
    },
  });
}

function pageResponse() {
  return jsonResponse({
    id: PAGE_ID,
    properties: {
      Name: {
        type: "title",
        title: [
          {
            type: "text",
            text: {
              content: "模块化不是拆分，而是让变化有边界",
            },
            plain_text: "模块化不是拆分，而是让变化有边界",
          },
        ],
      },
    },
  });
}

function blocksResponse() {
  return jsonResponse({
    results: [
      {
        object: "block",
        id: "block-1",
        type: "paragraph",
        has_children: false,
        paragraph: {
          rich_text: [
            {
              type: "text",
              text: {
                content: "Webhook sync test",
              },
              plain_text: "Webhook sync test",
            },
          ],
        },
      },
    ],
    has_more: false,
    next_cursor: null,
  });
}

function installFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    return handler(url, init);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

test("syncNotionPage skips pages that are not in the manifest", async () => {
  process.env.NOTION_API_TOKEN = "test-notion-token";
  process.env.GITHUB_TOKEN = "test-github-token";

  let calls = 0;

  const restore = installFetch(async (url) => {
    calls += 1;

    assert.match(
      url,
      /raw\.githubusercontent\.com\/ZoeFaniaChau\/knowledge-workbench\/main\/sync\/manifest\.json$/,
    );

    return jsonResponse({
      version: 1,
      objects: {},
    });
  });

  try {
    const result = await syncNotionPage("not-in-manifest");

    assert.deepEqual(result, {
      synced: false,
      reason: "page_not_in_manifest",
      pageId: "not-in-manifest",
    });

    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test("syncNotionPage syncs a manifest page through Notion and GitHub", async () => {
  process.env.NOTION_API_TOKEN = "test-notion-token";
  process.env.GITHUB_TOKEN = "test-github-token";

  const calls: Array<{ url: string; method: string }> = [];
  const patchBodies: Array<Record<string, any>> = [];

  const restore = installFetch(async (url, init) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url.includes("raw.githubusercontent.com")) {
      return manifestResponse();
    }

    if (url === "https://api.notion.com/v1/pages/" + PAGE_ID) {
      if (method === "PATCH") {
        patchBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({});
      }

      return pageResponse();
    }

    if (
      url ===
      "https://api.notion.com/v1/blocks/" +
        PAGE_ID +
        "/children?page_size=100"
    ) {
      return blocksResponse();
    }

    if (
      url ===
      "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/" +
        encodeURIComponent(FILE_PATH).replace(/%2F/g, "/") +
        "?ref=main"
    ) {
      return jsonResponse(
        {
          sha: "existing-sha",
          content: "old content",
          encoding: "base64",
        },
        200,
      );
    }

    if (
      url ===
      "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/" +
        encodeURIComponent(FILE_PATH).replace(/%2F/g, "/")
    ) {
      assert.equal(method, "PUT");

      const body = JSON.parse(String(init?.body));

      assert.equal(body.message, "sync: update " + FILE_PATH);
      assert.equal(body.branch, "main");
      assert.equal(typeof body.content, "string");
      assert.equal(body.sha, "existing-sha");

      return jsonResponse({
        content: {
          path: FILE_PATH,
          sha: "new-file-sha",
        },
        commit: {
          sha: "new-commit-sha",
        },
      });
    }

    throw new Error("Unexpected fetch: " + method + " " + url);
  });

  try {
    const result = await syncNotionPage(PAGE_ID);

    assert.equal(result.synced, true);
    assert.equal(result.skipped, false);
    assert.equal(result.pageId, PAGE_ID);
    assert.equal(result.title, "模块化不是拆分，而是让变化有边界");
    assert.equal(result.path, FILE_PATH);
    assert.equal(result.commitSha, "new-commit-sha");
    assert.equal(result.fileSha, "new-file-sha");
    assert.equal(typeof result.syncedAt, "string");

    const patchCalls = calls.filter(
      (call) =>
        call.url ===
          "https://api.notion.com/v1/pages/" + PAGE_ID &&
        call.method === "PATCH",
    );

    assert.equal(patchCalls.length, 2);
    assert.equal(patchBodies.length, 2);

    assert.equal(
      patchBodies[1].properties["GitHub Last Synced SHA"].rich_text[0].text.content,
      "new-file-sha",
    );
  } finally {
    restore();
  }
});

test("syncNotionPage skips GitHub write when content is unchanged", async () => {
  process.env.NOTION_API_TOKEN = "test-notion-token";
  process.env.GITHUB_TOKEN = "test-github-token";

  const expectedMarkdown =
    "# 模块化不是拆分，而是让变化有边界\n\nWebhook sync test\n";

  let githubPutCalls = 0;

  const restore = installFetch(async (url, init) => {
    const method = init?.method ?? "GET";

    if (url.includes("raw.githubusercontent.com")) {
      return manifestResponse();
    }

    if (url === "https://api.notion.com/v1/pages/" + PAGE_ID) {
      if (method === "PATCH") {
        return jsonResponse({});
      }

      return pageResponse();
    }

    if (
      url ===
      "https://api.notion.com/v1/blocks/" +
        PAGE_ID +
        "/children?page_size=100"
    ) {
      return blocksResponse();
    }

    const githubFileUrl =
      "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/" +
      encodeURIComponent(FILE_PATH).replace(/%2F/g, "/") +
      "?ref=main";

    if (url === githubFileUrl) {
      return jsonResponse({
        sha: "same-sha",
        content: Buffer.from(expectedMarkdown, "utf8").toString("base64"),
        encoding: "base64",
      });
    }

    if (
      url ===
      "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/" +
        encodeURIComponent(FILE_PATH).replace(/%2F/g, "/")
    ) {
      githubPutCalls += 1;
      return jsonResponse(
        {
          content: {
            path: FILE_PATH,
            sha: "unexpected",
          },
          commit: {
            sha: "unexpected",
          },
        },
        500,
      );
    }

    throw new Error("Unexpected fetch: " + method + " " + url);
  });

  try {
    const result = await syncNotionPage(PAGE_ID);

    assert.equal(result.synced, true);
    assert.equal(result.skipped, true);
    assert.equal(result.pageId, PAGE_ID);
    assert.equal(result.path, FILE_PATH);
    assert.equal(githubPutCalls, 0);
  } finally {
    restore();
  }
});
test("syncNotionPage marks the page as Error when Notion sync fails", async () => {
  process.env.NOTION_API_TOKEN = "test-notion-token";
  process.env.GITHUB_TOKEN = "test-github-token";

  const patchStatuses: string[] = [];

  const restore = installFetch(async (url, init) => {
    const method = init?.method ?? "GET";

    if (url.includes("raw.githubusercontent.com")) {
      return manifestResponse();
    }

    if (url === "https://api.notion.com/v1/pages/" + PAGE_ID) {
      if (method === "PATCH") {
        const body = JSON.parse(String(init?.body));
        patchStatuses.push(body.properties["GitHub Sync Status"].select.name);
        return jsonResponse({});
      }

      return jsonResponse(
        {
          error: "internal_error",
        },
        500,
      );
    }

    throw new Error("Unexpected fetch: " + method + " " + url);
  });

  try {
    await assert.rejects(
      () => syncNotionPage(PAGE_ID),
      /Notion API 500/,
    );

    assert.deepEqual(patchStatuses, ["Pending", "Error"]);
  } finally {
    restore();
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyManifestSync,
  computeManifestSync,
} from "../lib/manifest-sync.ts";

const notionPage = {
  id: "page-1",
  properties: {
    Title: {
      type: "title",
      title: [
        {
          plain_text: "模块化不是拆分，而是让变化有边界",
        },
      ],
    },
    Kind: {
      type: "select",
      select: {
        name: "Research",
      },
    },
    "Output Target": {
      type: "multi_select",
      multi_select: [
        {
          name: "GitHub",
        },
      ],
    },
    "GitHub Path": {
      type: "rich_text",
      rich_text: [
        {
          plain_text:
            "knowledge/research/模块化不是拆分，而是让变化有边界.md",
        },
      ],
    },
  },
};

const githubManifest = {
  version: 1,
  source: "notion",
  workspace: "Zoe Fañiá Chau 的 Notion",
  data_source: "7dbb6604-ba39-483f-948b-92e6ba6208e3",
  objects: {},
} as const;

function installFetch() {
  const calls: Array<{
    url: string;
    init?: RequestInit;
  }> = [];

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    calls.push({
      url,
      init,
    });

    if (url.includes("/data_sources/")) {
      return new Response(
        JSON.stringify({
          results: [notionPage],
          has_more: false,
          next_cursor: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (
      url.includes(
        "/repos/ZoeFaniaChau/knowledge-workbench/contents/sync/manifest.json",
      )
    ) {
      const encoded = Buffer.from(
        JSON.stringify(githubManifest),
        "utf8",
      ).toString("base64");

      return new Response(
        JSON.stringify({
          content: encoded,
          encoding: "base64",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw new Error("Unexpected fetch URL: " + url);
  };

  return calls;
}

test("computes the Manifest diff from Notion and GitHub", async () => {
  process.env.NOTION_API_TOKEN = "test-notion-token";
  process.env.NOTION_DATA_SOURCE_ID =
    "7dbb6604-ba39-483f-948b-92e6ba6208e3";
  process.env.GITHUB_TOKEN = "test-github-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  const calls = installFetch();

  const result = await computeManifestSync();

  assert.deepEqual(result.before, githubManifest);

  assert.deepEqual(result.after.objects, {
    "page-1": {
      title: "模块化不是拆分，而是让变化有边界",
      kind: "Research",
      path:
        "knowledge/research/模块化不是拆分，而是让变化有边界.md",
    },
  });

  assert.deepEqual(result.diff.added, {
    "page-1": {
      title: "模块化不是拆分，而是让变化有边界",
      kind: "Research",
      path:
        "knowledge/research/模块化不是拆分，而是让变化有边界.md",
    },
  });

  assert.deepEqual(result.diff.removed, {});
  assert.deepEqual(result.diff.changed, {});

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/data_sources\/7dbb6604/);
  assert.match(
    calls[1].url,
    /\/contents\/sync\/manifest\.json\?ref=main/,
  );
});

test("returns an empty diff when Notion and GitHub already match", async () => {
  process.env.NOTION_API_TOKEN = "test-notion-token";
  process.env.NOTION_DATA_SOURCE_ID =
    "7dbb6604-ba39-483f-948b-92e6ba6208e3";
  process.env.GITHUB_TOKEN = "test-github-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  const matchingManifest = {
    ...githubManifest,
    objects: {
      "page-1": {
        title: "模块化不是拆分，而是让变化有边界",
        kind: "Research",
        path:
          "knowledge/research/模块化不是拆分，而是让变化有边界.md",
      },
    },
  };

  globalThis.fetch = async (
    input: string | URL | Request,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.includes("/data_sources/")) {
      return new Response(
        JSON.stringify({
          results: [notionPage],
          has_more: false,
          next_cursor: null,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (
      url.includes(
        "/repos/ZoeFaniaChau/knowledge-workbench/contents/sync/manifest.json",
      )
    ) {
      const encoded = Buffer.from(
        JSON.stringify(matchingManifest),
        "utf8",
      ).toString("base64");

      return new Response(
        JSON.stringify({
          content: encoded,
          encoding: "base64",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw new Error("Unexpected fetch URL: " + url);
  };

  const result = await computeManifestSync();

  assert.deepEqual(result.diff, {
    added: {},
    removed: {},
    changed: {},
  });
});

test("applies the Manifest when changes are detected", async () => {
  process.env.GITHUB_TOKEN = "test-github-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  const result = {
    before: githubManifest,
    after: {
      ...githubManifest,
      objects: {
        "page-1": {
          title: "模块化不是拆分，而是让变化有边界",
          kind: "Research",
          path:
            "knowledge/research/模块化不是拆分，而是让变化有边界.md",
        },
      },
    },
    diff: {
      added: {
        "page-1": {
          title: "模块化不是拆分，而是让变化有边界",
          kind: "Research",
          path:
            "knowledge/research/模块化不是拆分，而是让变化有边界.md",
        },
      },
      removed: {},
      changed: {},
    },
  };

  let writeCalled = false;

  globalThis.fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (
      url.includes(
        "/repos/ZoeFaniaChau/knowledge-workbench/contents/sync/manifest.json",
      )
    ) {
      if (init?.method === "PUT") {
        writeCalled = true;

        return new Response(
          JSON.stringify({
            content: {
              path: "sync/manifest.json",
            },
            commit: {
              sha: "commit-sha",
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      const encoded = Buffer.from(
        JSON.stringify(githubManifest),
        "utf8",
      ).toString("base64");

      return new Response(
        JSON.stringify({
          content: encoded,
          encoding: "base64",
          sha: "manifest-sha",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    throw new Error("Unexpected fetch URL: " + url);
  };

  const applied = await applyManifestSync(result);

  assert.equal(applied.applied, true);
  assert.equal(applied.reason, "changes_detected");
  assert.equal(writeCalled, true);
});

test("does not write the Manifest when there are no changes", async () => {
  const result = {
    before: githubManifest,
    after: githubManifest,
    diff: {
      added: {},
      removed: {},
      changed: {},
    },
  };

  let writeCalled = false;

  globalThis.fetch = async () => {
    writeCalled = true;
    throw new Error("GitHub write should not be called");
  };

  const applied = await applyManifestSync(result);

  assert.equal(applied.applied, false);
  assert.equal(applied.reason, "no_changes");
  assert.equal(writeCalled, false);
});

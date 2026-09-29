import assert from "node:assert/strict";
import test from "node:test";

import {
  readGithubManifest,
  writeGithubManifest,
} from "../lib/github-manifest.ts";

function installFetch(
  responseBody: unknown,
  status = 200,
) {
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

    calls.push({ url, init });

    return new Response(
      JSON.stringify(responseBody),
      {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  return calls;
}

const manifest = {
  version: 1 as const,
  source: "notion" as const,
  workspace: "Zoe Fañiá Chau 的 Notion",
  data_source: "7dbb6604-ba39-483f-948b-92e6ba6208e3",
  objects: {
    "page-1": {
      title: "模块化不是拆分，而是让变化有边界",
      kind: "Research",
      path:
        "knowledge/research/模块化不是拆分，而是让变化有边界.md",
    },
  },
};

test("reads and decodes the GitHub manifest", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  const encoded = Buffer.from(
    JSON.stringify(manifest),
    "utf8",
  ).toString("base64");

  const calls = installFetch({
    content: encoded,
    encoding: "base64",
  });

  const result = await readGithubManifest();

  assert.deepEqual(result, manifest);

  assert.equal(calls.length, 1);

  assert.equal(
    calls[0].url,
    "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/sync/manifest.json?ref=main",
  );

  assert.equal(calls[0].init?.method, undefined);

  const headers = new Headers(calls[0].init?.headers);

  assert.equal(
    headers.get("Accept"),
    "application/vnd.github+json",
  );

  assert.equal(
    headers.get("X-GitHub-Api-Version"),
    "2022-11-28",
  );

  assert.equal(
    headers.get("Authorization"),
    "Bearer test-token",
  );
});

test("rejects a failed GitHub manifest request", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  installFetch(
    {
      message: "Not Found",
    },
    404,
  );

  await assert.rejects(
    () => readGithubManifest(),
    /GitHub manifest read 404:.*Not Found/,
  );
});

test("rejects a GitHub response without base64 content", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  installFetch({
    content: "not-base64",
    encoding: "utf-8",
  });

  await assert.rejects(
    () => readGithubManifest(),
    /has no base64 content/,
  );
});

test("writes the GitHub manifest to the fixed manifest path", async () => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY =
    "ZoeFaniaChau/knowledge-workbench";

  const calls = installFetch({
    content: "",
    encoding: "base64",
  });

  await writeGithubManifest(manifest);

  assert.equal(calls.length, 2);

  assert.equal(
    calls[0].url,
    "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/sync/manifest.json?ref=main",
  );

  assert.equal(
    calls[1].url,
    "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/sync/manifest.json",
  );

  assert.equal(calls[1].init?.method, "PUT");

  const body = JSON.parse(
    String(calls[1].init?.body),
  ) as {
    message?: string;
    content?: string;
    branch?: string;
  };

  assert.equal(body.message, "sync: update manifest");
  assert.equal(body.branch, "main");

  assert.equal(
    Buffer.from(body.content ?? "", "base64").toString("utf8"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
});

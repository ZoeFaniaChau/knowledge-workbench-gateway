import assert from "node:assert/strict";
import test from "node:test";

import { readGithubFile } from "../lib/github-file.ts";

const originalFetch = globalThis.fetch;
const originalToken = process.env.GITHUB_TOKEN;

function restore() {
  globalThis.fetch = originalFetch;

  if (originalToken === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = originalToken;
  }
}

test("readGithubFile reads and decodes a GitHub file", async () => {
  process.env.GITHUB_TOKEN = "test-token";

  globalThis.fetch = async (input, init) => {
    assert.equal(
      input,
      "https://api.github.com/repos/ZoeFaniaChau/knowledge-workbench/contents/knowledge/research/test.md?ref=main",
    );

    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      "Bearer test-token",
    );

    return new Response(
      JSON.stringify({
        type: "file",
        path: "knowledge/research/test.md",
        sha: "blob-sha-123",
        encoding: "base64",
        content: Buffer.from("# Test\n\nHello").toString("base64"),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  try {
    const result = await readGithubFile(
      "knowledge/research/test.md",
    );

    assert.deepEqual(result, {
      path: "knowledge/research/test.md",
      sha: "blob-sha-123",
      content: "# Test\n\nHello",
    });
  } finally {
    restore();
  }
});

test("readGithubFile returns null when the GitHub file does not exist", async () => {
  process.env.GITHUB_TOKEN = "test-token";

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        message: "Not Found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

  try {
    const result = await readGithubFile(
      "knowledge/research/missing.md",
    );

    assert.equal(result, null);
  } finally {
    restore();
  }
});

test("readGithubFile rejects invalid GitHub file responses", async () => {
  process.env.GITHUB_TOKEN = "test-token";

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        type: "dir",
        path: "knowledge/research",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

  try {
    await assert.rejects(
      readGithubFile("knowledge/research"),
      /GitHub file response is invalid/,
    );
  } finally {
    restore();
  }
});

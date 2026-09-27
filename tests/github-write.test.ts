import test from "node:test";
import assert from "node:assert/strict";

import { writeGithubFile } from "../lib/sync.ts";

const originalFetch = globalThis.fetch;
const originalGithubToken = process.env.GITHUB_TOKEN;

test.beforeEach(() => {
  process.env.GITHUB_TOKEN = "test-token";
});

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
 
  if (originalGithubToken === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = originalGithubToken;
  }
});

test("409 retry re-reads GitHub and skips when another writer already produced identical content", async () => {
  const calls: Array<{ url: string; method: string }> = [];

  let readCount = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";

    calls.push({ url, method });

    if (method === "GET") {
      readCount += 1;

      if (readCount === 1) {
        return jsonResponse({
          sha: "old-sha",
          content: Buffer.from("old content").toString("base64"),
          encoding: "base64",
        });
      }

      return jsonResponse({
        sha: "new-sha",
        content: Buffer.from("new content").toString("base64"),
        encoding: "base64",
      });
    }

    if (method === "PUT") {
      if (calls.filter((call) => call.method === "PUT").length === 1) {
        return jsonResponse(
          {
            message: "Reference update failed",
          },
          409,
        );
      }

      throw new Error("The second PUT should never happen.");
    }

    throw new Error("Unexpected request.");
  };

  const result = await writeGithubFile(
    "knowledge/research/test.md",
    "new content",
    "sync: update knowledge/research/test.md",
  );

  assert.equal(result.skipped, true);
  assert.equal(result.content?.sha, "new-sha");

  assert.deepEqual(
    calls.map((call) => call.method),
    ["GET", "PUT", "GET"],
  );
});

test("409 retry writes again with the latest SHA when content is different", async () => {
  const calls: Array<{
    url: string;
    method: string;
    body?: string;
  }> = [];

  let readCount = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";

    calls.push({
      url,
      method,
      body: typeof init.body === "string" ? init.body : undefined,
    });

    if (method === "GET") {
      readCount += 1;

      if (readCount === 1) {
        return jsonResponse({
          sha: "old-sha",
          content: Buffer.from("old content").toString("base64"),
          encoding: "base64",
        });
      }

      return jsonResponse({
        sha: "latest-sha",
        content: Buffer.from("other content").toString("base64"),
        encoding: "base64",
      });
    }

    if (method === "PUT") {
      const putCount = calls.filter((call) => call.method === "PUT").length;

      if (putCount === 1) {
        return jsonResponse(
          {
            message: "Reference update failed",
          },
          409,
        );
      }

      return jsonResponse({
        content: {
          path: "knowledge/research/test.md",
          sha: "final-sha",
        },
        commit: {
          sha: "commit-sha",
        },
      });
    }

    throw new Error("Unexpected request.");
  };

  const result = await writeGithubFile(
    "knowledge/research/test.md",
    "new content",
    "sync: update knowledge/research/test.md",
  );

  assert.equal(result.skipped, false);
  assert.equal(result.content?.sha, "final-sha");
  assert.equal(result.commit?.sha, "commit-sha");

  const putBodies = calls
    .filter((call) => call.method === "PUT")
    .map((call) => JSON.parse(call.body ?? "{}"));

  assert.equal(putBodies.length, 2);
  assert.equal(putBodies[0].sha, "old-sha");
  assert.equal(putBodies[1].sha, "latest-sha");
});

import assert from "node:assert/strict";
import test from "node:test";

import { queryNotionDataSource } from "../lib/notion-data-source.ts";

function installFetch(
  responses: Array<{
    results: Array<{ id: string }>;
    has_more: boolean;
    next_cursor: string | null;
  }>,
) {
  const calls: Array<{
    url: string;
    init?: RequestInit;
  }> = [];

  let index = 0;

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

    const response = responses[index];

    if (!response) {
      throw new Error("Unexpected fetch call");
    }

    index += 1;

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  };

  return calls;
}

test("queries a Notion data source", async () => {
  process.env.NOTION_API_TOKEN = "test-token";

  const calls = installFetch([
    {
      results: [{ id: "page-1" }],
      has_more: false,
      next_cursor: null,
    },
  ]);

  const pages = await queryNotionDataSource(
    "data-source-123",
  );

  assert.deepEqual(pages, [{ id: "page-1" }]);
  assert.equal(calls.length, 1);

  assert.equal(
    calls[0].url,
    "https://api.notion.com/v1/data_sources/data-source-123/query",
  );

  assert.equal(calls[0].init?.method, "POST");

  assert.deepEqual(
    JSON.parse(String(calls[0].init?.body)),
    {
      page_size: 100,
    },
  );
});

test("follows Notion data source pagination", async () => {
  process.env.NOTION_API_TOKEN = "test-token";

  const calls = installFetch([
    {
      results: [{ id: "page-1" }],
      has_more: true,
      next_cursor: "cursor-1",
    },
    {
      results: [{ id: "page-2" }],
      has_more: false,
      next_cursor: null,
    },
  ]);

  const pages = await queryNotionDataSource(
    "data-source-123",
  );

  assert.deepEqual(pages, [
    { id: "page-1" },
    { id: "page-2" },
  ]);

  assert.equal(calls.length, 2);

  assert.deepEqual(
    JSON.parse(String(calls[1].init?.body)),
    {
      page_size: 100,
      start_cursor: "cursor-1",
    },
  );
});

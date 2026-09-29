import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManifestFromNotionPages,
  notionPageToManifestCandidate,
} from "../lib/manifest-source.ts";

const baseManifest = {
  version: 1 as const,
  source: "notion" as const,
  workspace: "Zoe Fañiá Chau 的 Notion",
  data_source: "7dbb6604-ba39-483f-948b-92e6ba6208e3",
};

test("maps a GitHub-targeted Notion page to a manifest entry", () => {
  const page = {
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
        multi_select: [{ name: "GitHub" }],
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

  const candidate = notionPageToManifestCandidate(page);

  assert.deepEqual(candidate, {
    id: "page-1",
    title: "模块化不是拆分，而是让变化有边界",
    kind: "Research",
    outputTarget: ["GitHub"],
    githubPath:
      "knowledge/research/模块化不是拆分，而是让变化有边界.md",
  });

  const manifest = buildManifestFromNotionPages(
    [page],
    baseManifest,
  );

  assert.deepEqual(manifest.objects["page-1"], {
    title: "模块化不是拆分，而是让变化有边界",
    kind: "Research",
    path:
      "knowledge/research/模块化不是拆分，而是让变化有边界.md",
  });
});

test("excludes pages without GitHub output target", () => {
  const page = {
    id: "page-2",
    properties: {
      Title: {
        type: "title",
        title: [{ plain_text: "Not GitHub" }],
      },
      Kind: {
        type: "select",
        select: {
          name: "Reference",
        },
      },
      "Output Target": {
        type: "multi_select",
        multi_select: [{ name: "Obsidian" }],
      },
      "GitHub Path": {
        type: "rich_text",
        rich_text: [
          {
            plain_text: "knowledge/reference/not-github.md",
          },
        ],
      },
    },
  };

  const manifest = buildManifestFromNotionPages(
    [page],
    baseManifest,
  );

  assert.equal(manifest.objects["page-2"], undefined);
});

test("excludes GitHub-targeted pages without a GitHub path", () => {
  const page = {
    id: "page-3",
    properties: {
      Title: {
        type: "title",
        title: [{ plain_text: "Missing Path" }],
      },
      Kind: {
        type: "select",
        select: {
          name: "Reference",
        },
      },
      "Output Target": {
        type: "multi_select",
        multi_select: [{ name: "GitHub" }],
      },
      "GitHub Path": {
        type: "rich_text",
        rich_text: [],
      },
    },
  };

  const manifest = buildManifestFromNotionPages(
    [page],
    baseManifest,
  );

  assert.equal(manifest.objects["page-3"], undefined);
});

test("supports rich text split across multiple fragments", () => {
  const page = {
    id: "page-4",
    properties: {
      Title: {
        type: "title",
        title: [
          { plain_text: "Split " },
          { plain_text: "Title" },
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
        multi_select: [{ name: "GitHub" }],
      },
      "GitHub Path": {
        type: "rich_text",
        rich_text: [
          {
            plain_text: "knowledge/research/",
          },
          {
            plain_text: "split.md",
          },
        ],
      },
    },
  };

  const candidate = notionPageToManifestCandidate(page);

  assert.equal(candidate.title, "Split Title");
  assert.equal(candidate.githubPath, "knowledge/research/split.md");
});

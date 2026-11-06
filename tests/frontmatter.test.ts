import assert from "node:assert/strict";
import test from "node:test";

import { buildMarkdownDocument } from "../lib/frontmatter.ts";

test("frontmatter records stable Notion source identity and manifest kind", () => {
  const markdown = buildMarkdownDocument({
    pageId: "3e35b0a8-98a3-8096-aa3b-e575292670da",
    kind: "Research",
    title: "A durable title",
    body: "Body text",
  });

  assert.equal(
    markdown,
    [
      "---",
      "source: notion",
      'source_page_id: "3e35b0a8-98a3-8096-aa3b-e575292670da"',
      'kind: "Research"',
      "---",
      "",
      "# A durable title",
      "",
      "Body text",
      "",
    ].join("\n"),
  );
});

test("frontmatter safely quotes metadata containing YAML-sensitive characters", () => {
  const markdown = buildMarkdownDocument({
    pageId: 'page-"quoted"\\id',
    kind: "Research: Notes",
    title: "Title",
    body: "",
  });

  assert.match(markdown, /^source_page_id: "page-\\"quoted\\"\\\\id"$/m);
  assert.match(markdown, /^kind: "Research: Notes"$/m);
});

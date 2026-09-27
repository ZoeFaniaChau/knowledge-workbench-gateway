import test from "node:test";
import assert from "node:assert/strict";

import {
  blockToMarkdown,
  richTextToMarkdown,
  type NotionBlock,
} from "../lib/markdown.ts";

test("plain text escapes Markdown control characters", () => {
  assert.equal(
    richTextToMarkdown([
      {
        type: "text",
        plain_text: "# [literal] *text* \\ path",
      },
    ]),
    "\\# \\[literal\\] \\*text\\* \\\\ path",
  );
});

test("annotations are preserved as Markdown structure", () => {
  assert.equal(
    richTextToMarkdown([
      {
        type: "text",
        plain_text: "hello",
        annotations: {
          bold: true,
          italic: true,
          strikethrough: true,
        },
      },
    ]),
    "~~***hello***~~",
  );
});

test("links preserve link structure while escaping visible text", () => {
  assert.equal(
    richTextToMarkdown([
      {
        type: "text",
        plain_text: "[docs]",
        text: {
          content: "[docs]",
          link: {
            url: "https://example.com/docs",
          },
        },
      },
    ]),
    "[\\[docs\\]](https://example.com/docs)",
  );
});

test("code blocks preserve source text instead of Markdown-escaping code", () => {
  const block: NotionBlock = {
    id: "code-1",
    type: "code",
    code: {
      language: "ts",
      rich_text: [
        {
          type: "text",
          plain_text: "const x = *value*;\nreturn x;",
        },
      ],
    },
  };

  const fence = String.fromCharCode(96).repeat(3);

  assert.equal(
    blockToMarkdown(block),
    fence +
      "ts\n" +
      "const x = *value*;\n" +
      "return x;\n" +
      fence,
  );
});

test("block rendering preserves structural semantics", () => {
  assert.equal(
    blockToMarkdown({
      id: "h",
      type: "heading_2",
      heading_2: {
        rich_text: [
          {
            type: "text",
            plain_text: "Title",
          },
        ],
      },
    }),
    "## Title",
  );

  assert.equal(
    blockToMarkdown({
      id: "todo",
      type: "to_do",
      to_do: {
        checked: true,
        rich_text: [
          {
            type: "text",
            plain_text: "Done",
          },
        ],
      },
    }),
    "- [x] Done",
  );

  assert.equal(
    blockToMarkdown({
      id: "quote",
      type: "quote",
      quote: {
        rich_text: [
          {
            type: "text",
            plain_text: "Quoted",
          },
        ],
      },
    }),
    "> Quoted",
  );

  assert.equal(
    blockToMarkdown({
      id: "divider",
      type: "divider",
    }),
    "---",
  );
});

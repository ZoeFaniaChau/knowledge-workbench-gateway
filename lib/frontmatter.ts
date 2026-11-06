export type MarkdownDocumentInput = {
  pageId: string;
  kind: string;
  title: string;
  body: string;
};

/**
 * Build a self-describing Markdown projection of a Notion page.
 * JSON string literals are valid YAML double-quoted scalars and safely
 * preserve quotes, backslashes, and line breaks in metadata values.
 */
export function buildMarkdownDocument({
  pageId,
  kind,
  title,
  body,
}: MarkdownDocumentInput): string {
  return [
    "---",
    "source: notion",
    "source_page_id: " + JSON.stringify(pageId),
    "kind: " + JSON.stringify(kind),
    "---",
    "",
    "# " + title,
    "",
    body.trim(),
    "",
  ].join("\n");
}

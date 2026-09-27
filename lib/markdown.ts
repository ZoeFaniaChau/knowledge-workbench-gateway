export type NotionRichText = {
  type: string;
  plain_text?: string;
  text?: { content?: string; link?: { url?: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
};

export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]{}#+!|<>-]/g, (char) => "\\" + char);
}

export function richTextToMarkdown(
  items: NotionRichText[] = [],
  escape = true,
): string {
  return items
    .map((item) => {
      let text = escape
        ? escapeMarkdown(item.plain_text ?? item.text?.content ?? "")
        : (item.plain_text ?? item.text?.content ?? "");

      const link = item.text?.link?.url;

      if (link) text = "[" + text + "](" + link + ")";
      if (item.annotations?.code) {
        text = String.fromCharCode(96) + text + String.fromCharCode(96);
      }
      if (item.annotations?.bold) text = "**" + text + "**";
      if (item.annotations?.italic) text = "*" + text + "*";
      if (item.annotations?.strikethrough) text = "~~" + text + "~~";

      return text;
    })
    .join("");
}

function blockText(block: NotionBlock): string {
  const data = block[block.type] as
    | { rich_text?: NotionRichText[] }
    | undefined;

  return richTextToMarkdown(data?.rich_text);
}

export function blockToMarkdown(
  block: NotionBlock,
  depth = 0,
): string {
  const text = blockText(block);
  const indent = "  ".repeat(depth);

  switch (block.type) {
    case "paragraph":
      return text;

    case "heading_1":
      return "# " + text;

    case "heading_2":
      return "## " + text;

    case "heading_3":
      return "### " + text;

    case "bulleted_list_item":
      return indent + "- " + text;

    case "numbered_list_item":
      return indent + "1. " + text;

    case "to_do": {
      const data = block.to_do as
        | { checked?: boolean }
        | undefined;

      return (
        indent +
        "- [" +
        (data?.checked ? "x" : " ") +
        "] " +
        text
      );
    }

    case "quote":
      return text
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");

    case "callout":
      return "> " + text;

    case "code": {
      const data = block.code as {
        language?: string;
        rich_text?: NotionRichText[];
      };

      // Code is source material, not Markdown prose.
      // Do not escape its contents.
      const code = richTextToMarkdown(data.rich_text, false);

      return (
        "```" +
        (data.language ?? "") +
        "\n" +
        code +
        "\n```"
      );
    }

    case "divider":
      return "---";

    case "bookmark":
    case "embed":
      return text;

    default:
      return text;
  }
}

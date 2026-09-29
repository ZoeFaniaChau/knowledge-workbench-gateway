import {
  buildManifestEntry,
  type Manifest,
  type NotionManifestCandidate,
} from "./manifest.ts";

export type NotionPageProperty = {
  type?: string;
  title?: Array<{
    plain_text?: string;
    text?: {
      content?: string;
    };
  }>;
  rich_text?: Array<{
    plain_text?: string;
    text?: {
      content?: string;
    };
  }>;
  select?: {
    name?: string;
  } | null;
  multi_select?: Array<{
    name?: string;
  }>;
};

export type NotionPage = {
  id: string;
  properties?: Record<string, NotionPageProperty>;
};

function getPlainText(
  property: NotionPageProperty | undefined,
): string {
  if (!property) {
    return "";
  }

  const items =
    property.title ??
    property.rich_text ??
    [];

  return items
    .map((item) => item.plain_text ?? item.text?.content ?? "")
    .join("");
}

function getSelectName(
  property: NotionPageProperty | undefined,
): string {
  return property?.select?.name ?? "";
}

function getMultiSelectNames(
  property: NotionPageProperty | undefined,
): string[] {
  return (property?.multi_select ?? [])
    .map((item) => item.name ?? "")
    .filter(Boolean);
}

export function notionPageToManifestCandidate(
  page: NotionPage,
): NotionManifestCandidate {
  const properties = page.properties ?? {};

  return {
    id: page.id,
    title: getPlainText(properties["Title"]),
    kind: getSelectName(properties["Kind"]),
    outputTarget: getMultiSelectNames(properties["Output Target"]),
    githubPath: getPlainText(properties["GitHub Path"]),
  };
}

export function buildManifestFromNotionPages(
  pages: NotionPage[],
  baseManifest: Omit<Manifest, "objects">,
): Manifest {
  const objects: Manifest["objects"] = {};

  for (const page of pages) {
    const candidate = notionPageToManifestCandidate(page);
    const entry = buildManifestEntry(candidate);

    if (!entry) {
      continue;
    }

    objects[page.id] = entry;
  }

  return {
    ...baseManifest,
    objects,
  };
}

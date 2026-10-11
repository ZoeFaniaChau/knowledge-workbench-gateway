export type ManifestEntry = {
  title: string;
  kind: string;
  path: string;
};

export type Manifest = {
  version: 1;
  source: "notion";
  workspace: string;
  data_source: string;
  objects: Record<string, ManifestEntry>;
};

export type NotionManifestCandidate = {
  id: string;
  title: string;
  kind: string;
  outputTarget: string[];
  githubPath: string;
};

export function isValidGithubPath(path: string): boolean {
  const value = path.trim();

  if (!value || value.startsWith("/")) return false;
  if (/^https?:\/\//i.test(value)) return false;
  if (value.includes("\\") || value.includes("\0")) return false;
  if (value.includes("\n") || value.includes("\r")) return false;
  if (value.includes("](") || value.includes(")[")) return false;

  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    return false;
  }

  return true;
}

export function isGithubTarget(candidate: NotionManifestCandidate): boolean {
  return candidate.outputTarget.includes("GitHub");
}

function slugify(value: string, fallback: string): string {
  const slug = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function generateGithubPath(candidate: NotionManifestCandidate): string {
  const kind = slugify(candidate.kind, "reference");
  const title = slugify(candidate.title, "untitled");
  const pageId = candidate.id.replace(/-/g, "").toLowerCase();

  if (!pageId) {
    throw new Error("Cannot generate a GitHub path without a Notion page ID");
  }

  return `knowledge/${kind}/${title}--${pageId}.md`;
}

export function buildManifestEntry(
  candidate: NotionManifestCandidate,
  existingEntry?: ManifestEntry,
): ManifestEntry {
  const explicitPath = candidate.githubPath.trim();

  if (explicitPath && !isValidGithubPath(explicitPath)) {
    throw new Error(`Invalid GitHub Path for Notion page ${candidate.id}`);
  }

  const path = explicitPath
    ? explicitPath
    : existingEntry?.path ?? generateGithubPath(candidate);

  if (!isValidGithubPath(path)) {
    throw new Error(`Invalid existing GitHub path for Notion page ${candidate.id}`);
  }

  return {
    title: candidate.title.trim() || "Untitled",
    kind: candidate.kind.trim() || "Reference",
    path,
  };
}

export function upsertManifestEntry(
  manifest: Manifest,
  candidate: NotionManifestCandidate,
): Manifest {
  const entry = buildManifestEntry(candidate, manifest.objects[candidate.id]);

  return {
    ...manifest,
    objects: {
      ...manifest.objects,
      [candidate.id]: entry,
    },
  };
}

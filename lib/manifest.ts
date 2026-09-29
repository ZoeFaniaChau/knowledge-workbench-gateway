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

  if (!value) {
    return false;
  }

  if (value.startsWith("/")) {
    return false;
  }

  if (/^https?:\/\//i.test(value)) {
    return false;
  }

  if (value.includes("\n") || value.includes("\r")) {
    return false;
  }

  if (value.includes("](") || value.includes(")[")) {
    return false;
  }

  const segments = value.split("/");

  if (segments.some((segment) => segment === "..")) {
    return false;
  }

  return true;
}
export function isGithubTarget(candidate: NotionManifestCandidate): boolean {
  return candidate.outputTarget.includes("GitHub");
}

export function buildManifestEntry(
  candidate: NotionManifestCandidate,
): ManifestEntry | null {
  if (!isGithubTarget(candidate)) {
    return null;
  }

  const path = candidate.githubPath.trim();

  if (!isValidGithubPath(path)) {
    return null;
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
  const entry = buildManifestEntry(candidate);

  if (!entry) {
    const { [candidate.id]: _, ...objects } = manifest.objects;

    return {
      ...manifest,
      objects,
    };
  }

  return {
    ...manifest,
    objects: {
      ...manifest.objects,
      [candidate.id]: entry,
    },
  };
}

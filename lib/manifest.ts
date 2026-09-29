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

  if (!path) {
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

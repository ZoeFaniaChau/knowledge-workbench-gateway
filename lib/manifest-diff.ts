import type { Manifest, ManifestEntry } from "./manifest.ts";

export type ManifestDiff = {
  added: Record<string, ManifestEntry>;
  removed: Record<string, ManifestEntry>;
  changed: Record<
    string,
    {
      before: ManifestEntry;
      after: ManifestEntry;
    }
  >;
};

export function diffManifests(
  before: Manifest,
  after: Manifest,
): ManifestDiff {
  const added: Record<string, ManifestEntry> = {};
  const removed: Record<string, ManifestEntry> = {};
  const changed: ManifestDiff["changed"] = {};

  const beforeObjects = before.objects;
  const afterObjects = after.objects;

  for (const [id, entry] of Object.entries(afterObjects)) {
    const previous = beforeObjects[id];

    if (!previous) {
      added[id] = entry;
      continue;
    }

    if (
      previous.title !== entry.title ||
      previous.kind !== entry.kind ||
      previous.path !== entry.path
    ) {
      changed[id] = {
        before: previous,
        after: entry,
      };
    }
  }

  for (const [id, entry] of Object.entries(beforeObjects)) {
    if (!afterObjects[id]) {
      removed[id] = entry;
    }
  }

  return {
    added,
    removed,
    changed,
  };
}

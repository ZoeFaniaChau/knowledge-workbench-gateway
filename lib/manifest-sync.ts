import {
  buildManifestFromNotionPages,
} from "./manifest-source.ts";
import {
  queryNotionDataSource,
} from "./notion-data-source.ts";
import {
  readGithubManifest,
  writeGithubManifest,
} from "./github-manifest.ts";
import {
  diffManifests,
  type ManifestDiff,
} from "./manifest-diff.ts";
import type { Manifest } from "./manifest.ts";

const NOTION_DATA_SOURCE_ID =
  process.env.NOTION_DATA_SOURCE_ID ??
  "7dbb6604-ba39-483f-948b-92e6ba6208e3";

const MANIFEST_WORKSPACE =
  process.env.MANIFEST_WORKSPACE ??
  "Zoe Fañiá Chau 的 Notion";

export type ManifestSyncResult = {
  before: Manifest;
  after: Manifest;
  diff: ManifestDiff;
};

export async function computeManifestSync(): Promise<ManifestSyncResult> {
  const pages = await queryNotionDataSource(
    NOTION_DATA_SOURCE_ID,
  );

  const before = await readGithubManifest();

  const after = buildManifestFromNotionPages(
    pages,
    {
      version: 1,
      source: "notion",
      workspace: MANIFEST_WORKSPACE,
      data_source: NOTION_DATA_SOURCE_ID,
    },
  );

  const diff = diffManifests(before, after);

  return {
    before,
    after,
    diff,
  };
}

export function hasManifestChanges(
  diff: ManifestDiff,
): boolean {
  return (
    Object.keys(diff.added).length > 0 ||
    Object.keys(diff.removed).length > 0 ||
    Object.keys(diff.changed).length > 0
  );
}

export async function applyManifestSync(
  result: ManifestSyncResult,
) {
  if (!hasManifestChanges(result.diff)) {
    return {
      applied: false,
      reason: "no_changes",
    } as const;
  }

  const write = await writeGithubManifest(result.after);

  return {
    applied: true,
    reason: "changes_detected",
    write,
  } as const;
}

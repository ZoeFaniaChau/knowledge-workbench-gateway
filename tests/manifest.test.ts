import assert from "node:assert/strict";
import test from "node:test";

import {
  buildManifestEntry,
  isGithubTarget,
  upsertManifestEntry,
  type Manifest,
  type NotionManifestCandidate,
} from "../lib/manifest.ts";

const baseCandidate: NotionManifestCandidate = {
  id: "page-1",
  title: "模块化不是拆分，而是让变化有边界",
  kind: "Research",
  outputTarget: ["GitHub"],
  githubPath: "knowledge/research/modularity.md",
};

const baseManifest: Manifest = {
  version: 1,
  source: "notion",
  workspace: "Zoe Fañiá Chau 的 Notion",
  data_source: "7dbb6604-ba39-483f-948b-92e6ba6208e3",
  objects: {},
};

test("GitHub output target is recognized", () => {
  assert.equal(isGithubTarget(baseCandidate), true);

  assert.equal(
    isGithubTarget({
      ...baseCandidate,
      outputTarget: ["Notion CMS"],
    }),
    false,
  );
});

test("GitHub target with path becomes a manifest entry", () => {
  assert.deepEqual(buildManifestEntry(baseCandidate), {
    title: "模块化不是拆分，而是让变化有边界",
    kind: "Research",
    path: "knowledge/research/modularity.md",
  });
});

test("non-GitHub target is excluded", () => {
  assert.equal(
    buildManifestEntry({
      ...baseCandidate,
      outputTarget: ["Notion CMS"],
    }),
    null,
  );
});

test("GitHub target without path is excluded", () => {
  assert.equal(
    buildManifestEntry({
      ...baseCandidate,
      githubPath: "   ",
    }),
    null,
  );
});

test("upsert adds a GitHub manifest entry", () => {
  const result = upsertManifestEntry(baseManifest, baseCandidate);

  assert.deepEqual(result.objects["page-1"], {
    title: "模块化不是拆分，而是让变化有边界",
    kind: "Research",
    path: "knowledge/research/modularity.md",
  });
});

test("upsert removes an entry when GitHub output is disabled", () => {
  const manifest: Manifest = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "旧内容",
        kind: "Research",
        path: "knowledge/research/old.md",
      },
    },
  };

  const result = upsertManifestEntry(manifest, {
    ...baseCandidate,
    outputTarget: ["Notion CMS"],
  });

  assert.equal(result.objects["page-1"], undefined);
});

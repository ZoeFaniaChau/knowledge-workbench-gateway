import assert from "node:assert/strict";
import test from "node:test";

import { diffManifests } from "../lib/manifest-diff.ts";

const baseManifest = {
  version: 1 as const,
  source: "notion" as const,
  workspace: "Zoe Fañiá Chau 的 Notion",
  data_source: "7dbb6604-ba39-483f-948b-92e6ba6208e3",
};

test("detects added manifest entries", () => {
  const before = {
    ...baseManifest,
    objects: {},
  };

  const after = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "New Page",
        kind: "Research",
        path: "knowledge/new-page.md",
      },
    },
  };

  const diff = diffManifests(before, after);

  assert.deepEqual(diff.added, {
    "page-1": {
      title: "New Page",
      kind: "Research",
      path: "knowledge/new-page.md",
    },
  });

  assert.deepEqual(diff.removed, {});
  assert.deepEqual(diff.changed, {});
});

test("detects removed manifest entries", () => {
  const before = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "Old Page",
        kind: "Research",
        path: "knowledge/old-page.md",
      },
    },
  };

  const after = {
    ...baseManifest,
    objects: {},
  };

  const diff = diffManifests(before, after);

  assert.deepEqual(diff.added, {});
  assert.deepEqual(diff.removed, {
    "page-1": {
      title: "Old Page",
      kind: "Research",
      path: "knowledge/old-page.md",
    },
  });
  assert.deepEqual(diff.changed, {});
});

test("detects changed manifest entries", () => {
  const before = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "Original Title",
        kind: "Research",
        path: "knowledge/original.md",
      },
    },
  };

  const after = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "Updated Title",
        kind: "Research",
        path: "knowledge/updated.md",
      },
    },
  };

  const diff = diffManifests(before, after);

  assert.deepEqual(diff.added, {});
  assert.deepEqual(diff.removed, {});

  assert.deepEqual(diff.changed, {
    "page-1": {
      before: {
        title: "Original Title",
        kind: "Research",
        path: "knowledge/original.md",
      },
      after: {
        title: "Updated Title",
        kind: "Research",
        path: "knowledge/updated.md",
      },
    },
  });
});

test("returns an empty diff when manifests are identical", () => {
  const manifest = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "Same Page",
        kind: "Research",
        path: "knowledge/same.md",
      },
    },
  };

  const diff = diffManifests(manifest, manifest);

  assert.deepEqual(diff, {
    added: {},
    removed: {},
    changed: {},
  });
});

test("detects added, removed, and changed entries together", () => {
  const before = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "Changed",
        kind: "Research",
        path: "knowledge/changed.md",
      },
      "page-2": {
        title: "Removed",
        kind: "Reference",
        path: "knowledge/removed.md",
      },
    },
  };

  const after = {
    ...baseManifest,
    objects: {
      "page-1": {
        title: "Changed Again",
        kind: "Research",
        path: "knowledge/changed.md",
      },
      "page-3": {
        title: "Added",
        kind: "Research",
        path: "knowledge/added.md",
      },
    },
  };

  const diff = diffManifests(before, after);

  assert.deepEqual(diff.added, {
    "page-3": {
      title: "Added",
      kind: "Research",
      path: "knowledge/added.md",
    },
  });

  assert.deepEqual(diff.removed, {
    "page-2": {
      title: "Removed",
      kind: "Reference",
      path: "knowledge/removed.md",
    },
  });

  assert.deepEqual(diff.changed, {
    "page-1": {
      before: {
        title: "Changed",
        kind: "Research",
        path: "knowledge/changed.md",
      },
      after: {
        title: "Changed Again",
        kind: "Research",
        path: "knowledge/changed.md",
      },
    },
  });
});

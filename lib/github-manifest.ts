import type { Manifest } from "./manifest.ts";
import { writeGithubFile } from "./sync.ts";

const GITHUB_API_BASE = "https://api.github.com";

const GITHUB_REPOSITORY =
  process.env.GITHUB_REPOSITORY ??
  "ZoeFaniaChau/knowledge-workbench";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }

  return value;
}

async function githubFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = requireEnv("GITHUB_TOKEN");

  return fetch(GITHUB_API_BASE + path, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function readGithubManifest(): Promise<Manifest> {
  const encodedPath = "sync/manifest.json"
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const response = await githubFetch(
    "/repos/" +
      GITHUB_REPOSITORY +
      "/contents/" +
      encodedPath +
      "?ref=main",
  );

  if (!response.ok) {
    throw new Error(
      "GitHub manifest read " +
        response.status +
        ": " +
        (await response.text()),
    );
  }

  const file = (await response.json()) as {
    content?: string;
    encoding?: string;
  };

  if (!file.content || file.encoding !== "base64") {
    throw new Error("GitHub manifest response has no base64 content");
  }

  const content = Buffer.from(
    file.content.replace(/\n/g, ""),
    "base64",
  ).toString("utf8");

  return JSON.parse(content) as Manifest;
}

export async function writeGithubManifest(
  manifest: Manifest,
) {
  const content =
    JSON.stringify(manifest, null, 2) + "\n";

  return writeGithubFile(
    "sync/manifest.json",
    content,
    "sync: update manifest",
  );
}

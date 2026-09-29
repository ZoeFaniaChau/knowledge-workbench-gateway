import type { Manifest } from "./manifest.ts";

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
  const repository = GITHUB_REPOSITORY.split("/");

  if (repository.length !== 2) {
    throw new Error(
      "GITHUB_REPOSITORY must use owner/repository format",
    );
  }

  const [owner, repo] = repository;

  const endpoint =
    "/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repo) +
    "/contents/sync/manifest.json?ref=main";

  const response = await githubFetch(endpoint);

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
    throw new Error(
      "GitHub manifest response does not contain base64 content",
    );
  }

  const content = Buffer.from(
    file.content.replace(/\n/g, ""),
    "base64",
  ).toString("utf8");

  return JSON.parse(content) as Manifest;
}

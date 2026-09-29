type GitHubFileResponse = {
  type?: string;
  path?: string;
  sha?: string;
  content?: string;
  encoding?: string;
  message?: string;
};

export type GitHubFile = {
  path: string;
  sha: string;
  content: string;
};

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN is not configured");
  }

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function readGithubFile(
  path: string,
  owner = "ZoeFaniaChau",
  repo = "knowledge-workbench",
  ref = "main",
): Promise<GitHubFile | null> {
  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");

  const url =
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}` +
    `?ref=${encodeURIComponent(ref)}`;

  const response = await fetch(url, {
    headers: githubHeaders(),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `GitHub file read failed: ${response.status} ${body}`,
    );
  }

  const data = (await response.json()) as GitHubFileResponse;

  if (
    data.type !== "file" ||
    !data.path ||
    !data.sha ||
    !data.content ||
    data.encoding !== "base64"
  ) {
    throw new Error("GitHub file response is invalid");
  }

  const content = Buffer.from(
    data.content.replace(/\n/g, ""),
    "base64",
  ).toString("utf8");

  return {
    path: data.path,
    sha: data.sha,
    content,
  };
}

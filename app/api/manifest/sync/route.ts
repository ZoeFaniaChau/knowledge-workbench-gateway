import { NextResponse } from "next/server";

import {
  computeManifestSync,
} from "@/lib/manifest-sync";
import {
  writeGithubManifest,
} from "@/lib/github-manifest";

export const runtime = "nodejs";

function verifySyncToken(request: Request): boolean {
  const expected = process.env.MANIFEST_SYNC_TOKEN;

  if (!expected) {
    return false;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return false;
  }

  const received = authorization.slice("Bearer ".length);

  return received === expected;
}

export async function POST(request: Request) {
  if (!verifySyncToken(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  try {
    const result = await computeManifestSync();

    const body = await request.json().catch(() => ({}));

    const apply = body?.apply === true;

    if (!apply) {
      return NextResponse.json({
        ok: true,
        applied: false,
        diff: result.diff,
      });
    }

    const writeResult = await writeGithubManifest(result.after);

    return NextResponse.json({
      ok: true,
      applied: true,
      diff: result.diff,
      write: writeResult,
    });
  } catch (error) {
    console.error("Manifest sync failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Manifest sync failed",
      },
      { status: 500 },
    );
  }
}

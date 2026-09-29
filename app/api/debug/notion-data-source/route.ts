import { NextResponse } from "next/server";

import { queryNotionDataSource } from "@/lib/notion-data-source";
import { notionPageToManifestCandidate } from "@/lib/manifest-source";

export const runtime = "nodejs";

const DATA_SOURCE_ID =
  "7dbb6604-ba39-483f-948b-92e6ba6208e3";

export async function GET() {
  try {
    const pages = await queryNotionDataSource(DATA_SOURCE_ID);

    const candidates = pages.map(notionPageToManifestCandidate);

    return NextResponse.json({
      ok: true,
      count: candidates.length,
      pages: candidates,
    });
  } catch (error) {
    console.error("Notion data source debug failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error: "Notion data source query failed",
      },
      { status: 500 },
    );
  }
}

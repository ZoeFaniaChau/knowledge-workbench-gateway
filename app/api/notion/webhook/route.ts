import { NextResponse } from "next/server";
import { syncNotionPage } from "@/lib/sync";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      type?: string;
      timestamp?: string;
      workspace_id?: string;
      entity?: {
        id?: string;
        type?: string;
      };
    };

    console.log("Notion webhook received:", {
      id: body.id,
      type: body.type,
      timestamp: body.timestamp,
      workspace_id: body.workspace_id,
      entity_id: body.entity?.id,
      entity_type: body.entity?.type,
    });

    if (body.type !== "page.content_updated") {
      return NextResponse.json({
        ok: true,
        received: true,
        synced: false,
        reason: "event_not_supported_yet",
      });
    }

    const pageId = body.entity?.id;

    if (!pageId) {
      return NextResponse.json(
        {
          ok: false,
          received: true,
          error: "Missing entity id",
        },
        { status: 400 },
      );
    }

    const result = await syncNotionPage(pageId);

    return NextResponse.json({
      ok: true,
      received: true,
      ...result,
    });
  } catch (error) {
    console.error("Notion webhook sync failed:", error);

    return NextResponse.json(
      {
        ok: false,
        received: false,
        error: "Webhook sync failed",
      },
      { status: 500 },
    );
  }
}

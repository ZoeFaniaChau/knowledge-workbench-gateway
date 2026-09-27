import { NextResponse } from "next/server";

import {
  isNotionVerificationHandshake,
  verifyNotionSignature,
} from "@/lib/notion-webhook";
import { syncNotionPage } from "@/lib/sync";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "notion-webhook",
  });
}

export function HEAD() {
  return new Response(null, { status: 200 });
}

type NotionWebhookPayload = {
  id?: string;
  type?: string;
  timestamp?: string;
  workspace_id?: string;
  entity?: {
    id?: string;
    type?: string;
  };
};

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-notion-signature");

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        {
          ok: false,
          received: false,
          error: "Invalid JSON payload",
        },
        { status: 400 },
      );
    }

    if (isNotionVerificationHandshake(body)) {
      const verificationToken = body.verification_token;


      if (!verifyNotionSignature(rawBody, signature, verificationToken)) {
        console.warn("Rejected Notion verification handshake");

        return NextResponse.json(
          {
            ok: false,
            received: false,
            error: "Invalid verification signature",
          },
          { status: 401 },
        );
      }

      return NextResponse.json({
        ok: true,
        received: true,
        verification: true,
      });
    }

    if (!verifyNotionSignature(rawBody, signature)) {
      console.warn("Rejected Notion webhook: invalid signature");

      return NextResponse.json(
        {
          ok: false,
          received: false,
          error: "Invalid webhook signature",
        },
        { status: 401 },
      );
    }

    const payload = body as NotionWebhookPayload;

    console.log("Verified Notion webhook:", {
      id: payload.id,
      type: payload.type,
      timestamp: payload.timestamp,
      workspace_id: payload.workspace_id,
      entity_id: payload.entity?.id,
      entity_type: payload.entity?.type,
    });

    if (payload.type !== "page.content_updated") {
      return NextResponse.json({
        ok: true,
        received: true,
        verified: true,
        synced: false,
        reason: "event_not_supported_yet",
      });
    }

    const pageId = payload.entity?.id;

    if (!pageId) {
      return NextResponse.json(
        {
          ok: false,
          received: true,
          verified: true,
          error: "Missing entity id",
        },
        { status: 400 },
      );
    }

    const result = await syncNotionPage(pageId);

    return NextResponse.json({
      ok: true,
      received: true,
      verified: true,
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

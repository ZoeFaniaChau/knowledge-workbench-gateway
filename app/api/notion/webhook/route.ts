import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-notion-signature");

    console.log("Notion webhook diagnostic:", {
      hasSignature: Boolean(signature),
      signaturePrefix: signature?.slice(0, 7),
      bodyLength: rawBody.length,
    });

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

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        {
          ok: false,
          received: false,
          error: "Invalid webhook payload",
        },
        { status: 400 },
      );
    }

    const payload = body as {
      id?: string;
      type?: string;
      timestamp?: string;
      workspace_id?: string;
      entity?: {
        id?: string;
        type?: string;
      };
    };

    console.log("Notion webhook summary:", {
      id: payload.id,
      type: payload.type,
      timestamp: payload.timestamp,
      workspace_id: payload.workspace_id,
      entity_id: payload.entity?.id,
      entity_type: payload.entity?.type,
    });

    return NextResponse.json({
      ok: true,
      received: true,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        received: false,
        error: "Invalid request",
      },
      { status: 400 },
    );
  }
}

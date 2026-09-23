import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function verifyNotionSignature(rawBody: string, signature: string | null): boolean {
  const verificationToken = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;

  if (!verificationToken || !signature?.startsWith("sha256=")) {
    return false;
  }

  const receivedHex = signature.slice("sha256=".length);
  const expectedHex = createHmac("sha256", verificationToken)
    .update(rawBody, "utf8")
    .digest("hex");

  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

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

    // Notion sends the one-time verification token during subscription setup.
    // This branch is intentionally temporary: remove the token log after it
    // has been copied into NOTION_WEBHOOK_VERIFICATION_TOKEN.
    if (
      typeof body === "object" &&
      body !== null &&
      "verification_token" in body &&
      typeof body.verification_token === "string" &&
      !signature
    ) {
      console.warn("NOTION VERIFICATION TOKEN:", body.verification_token);

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

    console.log("Verified Notion webhook:", {
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
      verified: true,
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

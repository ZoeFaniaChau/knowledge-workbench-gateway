import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("Notion webhook keys:", Object.keys(body));

    console.log("Notion webhook summary:", {
      id: body.id,
      type: body.type,
      timestamp: body.timestamp,
      workspace_id: body.workspace_id,
      entity_id: body.entity?.id,
      entity_type: body.entity?.type,
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
        error: "Invalid JSON payload",
      },
      { status: 400 },
    );
  }
}

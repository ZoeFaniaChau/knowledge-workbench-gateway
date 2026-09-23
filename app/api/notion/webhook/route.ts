import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    console.log("Received Notion webhook:", body);

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

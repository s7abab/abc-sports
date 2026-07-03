import { NextResponse } from "next/server";

import { clearBroadcast, readBroadcast, saveBroadcast } from "@/lib/broadcast-storage";

export async function GET() {
  try {
    return NextResponse.json(await readBroadcast());
  } catch (error: unknown) {
    console.error("Error reading broadcast:", error);
    return NextResponse.json({ error: "Failed to read broadcast message" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const broadcast = await saveBroadcast(body);
    return NextResponse.json({ success: true, broadcast });
  } catch (error: unknown) {
    console.error("Error writing broadcast:", error);
    return NextResponse.json({ error: "Failed to write broadcast message" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const broadcast = await clearBroadcast();
    return NextResponse.json({ success: true, broadcast });
  } catch (error: unknown) {
    console.error("Error clearing broadcast:", error);
    return NextResponse.json({ error: "Failed to clear broadcast message" }, { status: 500 });
  }
}


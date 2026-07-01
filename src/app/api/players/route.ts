import { NextResponse } from "next/server";
import { readPlayers, savePlayers } from "@/lib/player-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readPlayers());
  } catch (error: unknown) {
    console.error("Error reading players:", error);
    return NextResponse.json(
      { error: "Failed to read player configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const updatedPlayers = await request.json();
    const players = await savePlayers(updatedPlayers);
    return NextResponse.json({ success: true, players });
  } catch (error: unknown) {
    console.error("Error writing players:", error);
    return NextResponse.json(
      { error: "Failed to write player configuration" },
      { status: 500 }
    );
  }
}

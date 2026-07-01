import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "players.json");

export async function GET() {
  try {
    const data = await fs.readFile(DATA_FILE, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (error: any) {
    console.error("Error reading players.json:", error);
    return NextResponse.json(
      { error: "Failed to read player configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const updatedPlayers = await request.json();

    if (!Array.isArray(updatedPlayers)) {
      return NextResponse.json(
        { error: "Invalid data format. Expected an array." },
        { status: 400 }
      );
    }

    // Ensure the data directory exists
    const dataDir = path.dirname(DATA_FILE);
    await fs.mkdir(dataDir, { recursive: true });

    await fs.writeFile(
      DATA_FILE,
      JSON.stringify(updatedPlayers, null, 2),
      "utf-8"
    );

    return NextResponse.json({ success: true, players: updatedPlayers });
  } catch (error: any) {
    console.error("Error writing players.json:", error);
    return NextResponse.json(
      { error: "Failed to write player configuration" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createMatch, readMatches } from "@/lib/match-storage";



export async function GET() {
  try {
    return NextResponse.json(await readMatches());
  } catch (error: unknown) {
    console.error("Error reading matches:", error);
    return NextResponse.json({ error: "Failed to read matches" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const match = await createMatch(payload);
    return NextResponse.json({ success: true, match });
  } catch (error: unknown) {
    console.error("Error writing match:", error);
    return NextResponse.json({ error: "Failed to save match" }, { status: 500 });
  }
}

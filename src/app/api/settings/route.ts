import { NextResponse } from "next/server";
import { readSettings, saveSettings } from "@/lib/settings-storage";

export async function GET() {
  try {
    return NextResponse.json(readSettings());
  } catch (error: unknown) {
    console.error("Error reading settings:", error);
    return NextResponse.json(
      { error: "Failed to read settings configuration" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const settings = saveSettings(body);
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    console.error("Error writing settings:", error);
    return NextResponse.json(
      { error: "Failed to write settings configuration" },
      { status: 500 }
    );
  }
}

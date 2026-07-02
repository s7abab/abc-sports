import { NextResponse } from "next/server";
import { deleteMatch, updateMatch, readMatch } from "@/lib/match-storage";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const match = await readMatch(id);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    return NextResponse.json(match);
  } catch (error: unknown) {
    console.error("Error reading match:", error);
    return NextResponse.json({ error: "Failed to read match" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const payload = await request.json();
    const match = await updateMatch(id, payload);
    return NextResponse.json({ success: true, match });
  } catch (error: unknown) {
    console.error("Error updating match:", error);
    return NextResponse.json({ error: "Failed to update match" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await deleteMatch(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting match:", error);
    return NextResponse.json({ error: "Failed to delete match" }, { status: 500 });
  }
}

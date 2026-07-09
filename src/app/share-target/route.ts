import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const title = String(formData.get("title") || "");
  const text = String(formData.get("text") || "");
  const url = String(formData.get("url") || "");
  const shared = [title, text, url].filter(Boolean).join("\n").slice(0, 1200);
  const target = new URL(shared ? `/dashboard?shared=${encodeURIComponent(shared)}` : "/dashboard", request.url);

  return NextResponse.redirect(target, 303);
}

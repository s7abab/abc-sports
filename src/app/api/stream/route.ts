import { proxyUpstreamStream } from "@/lib/stream-proxy";

function getTargetUrl(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return null;
  }

  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

async function handleStreamRequest(request: Request) {
  const targetUrl = getTargetUrl(request);

  if (!targetUrl) {
    return new Response("Missing or invalid stream URL.", { status: 400 });
  }

  try {
    return await proxyUpstreamStream(request, targetUrl);
  } catch (error) {
    console.error("Stream proxy failed:", error);
    return new Response("Unable to proxy stream.", { status: 502 });
  }
}

export async function GET(request: Request) {
  return handleStreamRequest(request);
}

export async function HEAD(request: Request) {
  return handleStreamRequest(request);
}

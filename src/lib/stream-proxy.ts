const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function createProxyUrl(target: string, requestUrl: string) {
  const proxyUrl = new URL("/api/stream", requestUrl);
  proxyUrl.searchParams.set("url", target);
  return proxyUrl.toString();
}

function resolveUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function rewritePlaylistManifest(manifest: string, upstreamUrl: string, requestUrl: string) {
  const proxyUrl = new URL("/api/stream", requestUrl).toString();

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
          const resolved = resolveUrl(uri, upstreamUrl);
          if (!resolved || !isHttpUrl(resolved)) {
            return `URI="${uri}"`;
          }

          return `URI="${createProxyUrl(resolved, proxyUrl)}"`;
        });
      }

      const resolved = resolveUrl(trimmed, upstreamUrl);
      if (!resolved || !isHttpUrl(resolved)) {
        return line;
      }

      return createProxyUrl(resolved, requestUrl);
    })
    .join("\n");
}

function shouldRewriteAsPlaylist(url: URL, contentType: string) {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("mpegurl") ||
    normalized.includes("m3u") ||
    url.pathname.endsWith(".m3u8") ||
    url.pathname.endsWith(".m3u")
  );
}

export async function proxyUpstreamStream(request: Request, upstreamUrl: string) {
  const requestUrl = request.url;
  const target = new URL(upstreamUrl);
  const isHeadRequest = request.method === "HEAD";
  const headers = new Headers();
  const incoming = request.headers;

  const forwardedHeaderNames = [
    "accept",
    "accept-language",
    "cache-control",
    "pragma",
    "range",
    "user-agent",
  ] as const;

  for (const name of forwardedHeaderNames) {
    const value = incoming.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  headers.set("accept", headers.get("accept") || "*/*");
  headers.set("user-agent", headers.get("user-agent") || "Mozilla/5.0");
  headers.set("referer", `${target.origin}/`);
  headers.set("origin", target.origin);

  const upstreamResponse = await fetch(target, {
    method: request.method,
    headers,
    redirect: "follow",
  });

  const contentType = upstreamResponse.headers.get("content-type") || "";
  const isPlaylist = shouldRewriteAsPlaylist(target, contentType);

  if (!isPlaylist || !upstreamResponse.body || isHeadRequest) {
    const responseHeaders = new Headers(upstreamResponse.headers);
    for (const headerName of HOP_BY_HOP_HEADERS) {
      responseHeaders.delete(headerName);
    }

    return new Response(isHeadRequest ? null : upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  }

  const manifest = await upstreamResponse.text();
  const rewritten = rewritePlaylistManifest(manifest, target.toString(), requestUrl);
  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const headerName of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(headerName);
  }
  responseHeaders.set("content-type", "application/vnd.apple.mpegurl; charset=utf-8");
  responseHeaders.delete("content-length");
  responseHeaders.set("cache-control", "no-store");

  return new Response(rewritten, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

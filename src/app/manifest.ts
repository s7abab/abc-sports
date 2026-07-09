import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ABC Sports",
    short_name: "ABC Sports",
    description: "A modern sports streaming home for featured fixtures and live match browsing.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06070b",
    theme_color: "#06070b",
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        description: "Open the ABC Sports control room.",
        url: "/dashboard",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Live Schedule",
        short_name: "Schedule",
        description: "Open the live match schedule.",
        url: "/",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Player 1",
        short_name: "Player",
        description: "Open the primary player.",
        url: "/player/1",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/maskable-icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

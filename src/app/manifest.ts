import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and auto-linked by Next. Makes Avni installable
// to the home screen, with a "Quick voice log" shortcut that jumps straight into
// the recorder (which auto-starts listening on open).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Avni · Food & Health Tracker",
    short_name: "Avni",
    description: "Speak your meals, symptoms and mood — Avni structures it and surfaces what affects how you feel.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f2",
    theme_color: "#ff5c00",
    orientation: "portrait",
    categories: ["health", "lifestyle", "medical"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Quick voice log",
        short_name: "Log",
        description: "Open the recorder and start listening",
        url: "/record",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}

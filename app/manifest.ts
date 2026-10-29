import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RefillRx — Mani, Benin City",
    short_name: "RefillRx",
    description: "Keep recurring medicine refills on track with Mani.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1efe8",
    theme_color: "#111111",
    icons: [
      {
        src: "/icons/refillrx.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/refillrx.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

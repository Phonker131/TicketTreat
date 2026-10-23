import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TicketTreat",
    short_name: "TicketTreat",
    description: "TicketTreat — discover events, reserve tickets and get helpful reminders in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#F0EBE1",
    theme_color: "#FF5533",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

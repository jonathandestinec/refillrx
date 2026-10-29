import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import PwaRegister from "./components/pwa-register";

export const metadata: Metadata = {
  title: "RefillRx | Refill care, kept close",
  description:
    "Keep recurring medicine refills on track with Mani, Benin City.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/refillrx.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

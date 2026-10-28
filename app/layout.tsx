import type { Metadata } from "next";
import "./globals.css";

import PwaRegister from "./components/pwa-register";

export const metadata: Metadata = {
  title: "RefillRx | Refill care, kept close",
  description:
    "Keep recurring medicine refills on track with Mani, Benin City.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

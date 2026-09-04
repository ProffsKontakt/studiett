import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Studiett" };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}

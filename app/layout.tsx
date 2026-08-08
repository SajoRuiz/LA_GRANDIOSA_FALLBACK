import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "La Grandiosa Commerce",
  description: "Commerce portal for La Grandiosa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import GlobalFooter from "./components/GlobalFooter";

export const metadata: Metadata = {
  title: "La Grandiosa Commerce",
  description: "Commerce portal for La Grandiosa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalFooter />
      </body>
    </html>
  );
}

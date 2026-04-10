import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WoundWatch",
  description:
    "Mobile-first wound monitoring workspace for longitudinal review, documentation support, and clinician confirmation."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

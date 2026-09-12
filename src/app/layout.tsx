import type { Metadata } from "next";
import "./globals.css";
import { GOOGLE_FONTS_URL } from "@/lib/designerTypes";

export const metadata: Metadata = {
  title: "Packaging Warehouse · 3D Box Preview",
  description:
    "Upload artwork, set dimensions, and preview it live wrapped on a parametric 3D folding-carton box.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={GOOGLE_FONTS_URL} rel="stylesheet" />
      </head>
      <body className="min-h-full bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Packaging Warehouse · 3D Box Preview",
  description:
    "Upload artwork, set dimensions, and preview it live wrapped on a parametric 3D folding-carton box.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}

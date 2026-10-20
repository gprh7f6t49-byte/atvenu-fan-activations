import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Activations · atVenu",
  description: "Fan opt-in, wallet passes and merch attribution for atVenu promo codes",
};

// Every page reads live data from the database.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* atVenu brand fonts: Rubik (headings), Inter (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Rubik:wght@400;500;600;700&display=swap" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

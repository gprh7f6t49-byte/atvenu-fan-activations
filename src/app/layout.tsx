import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Activations",
  description: "Fan opt-in, wallet passes and merch attribution for atVenu promo codes",
};

// Every page reads live data from the database.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rooms To Go — Roomie Mattress Advisor",
  description:
    "Chat with Roomie, your Rooms To Go virtual mattress advisor. Find the perfect mattress for the way you sleep.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

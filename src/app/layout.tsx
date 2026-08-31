import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "BookNest",
    template: "%s | BookNest"
  },
  description: "Booking and appointment management for service businesses.",
  applicationName: "BookNest",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg"
  },
  openGraph: {
    title: "BookNest",
    description: "Bookings, receipts, reminders, and iframe embeds for service businesses.",
    siteName: "BookNest",
    images: [
      {
        url: "/booknest-share.png",
        width: 1200,
        height: 630,
        alt: "BookNest booking and appointment management"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "BookNest",
    description: "Bookings, receipts, reminders, and iframe embeds for service businesses.",
    images: ["/booknest-share.png"]
  }
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  colorScheme: "light"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

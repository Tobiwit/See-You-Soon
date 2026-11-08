import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Fraunces, Newsreader } from "next/font/google";
import "./globals.css";

// All three faces include full Vietnamese support (Hội An, Phở, Đà Nẵng…).
// Expressive display voice — a soft, high-contrast 70s serif (Fraunces with its SOFT/WONK axes),
// used sparingly for titles and graphic moments.
const display = Fraunces({
  subsets: ["latin", "vietnamese"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
  display: "swap",
});
// Editorial voice — headings, body, numbers.
const serif = Newsreader({
  subsets: ["latin", "vietnamese"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-serif",
  display: "swap",
});
// Interface voice — labels, metadata, controls.
const sans = Be_Vietnam_Pro({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "See You Soon",
  description: "Alex + Toby — a small private publication for the time apart and the trip together.",
  applicationName: "See You Soon",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "See You Soon", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f3eee4",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}

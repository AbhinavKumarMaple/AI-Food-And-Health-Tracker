import type { Metadata, Viewport } from "next";
import { Inter, Funnel_Sans, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const funnel = Funnel_Sans({
  variable: "--font-funnel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Avni · Food & Health Tracker",
  description:
    "Speak your meals, symptoms and mood. Avni structures it and surfaces what affects how you feel.",
  applicationName: "Avni",
  appleWebApp: {
    capable: true,
    title: "Avni",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", sizes: "512x512" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fbf7f2",
  // When the on-screen keyboard opens, shrink the layout viewport (so 100dvh
  // contracts) instead of letting the browser scroll the page up under it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${funnel.variable} ${geist.variable}`}>
      <body>
        <Providers>
          <div className="app-frame">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

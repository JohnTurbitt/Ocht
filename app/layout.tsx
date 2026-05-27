import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.scss";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3002";
const appName = "Ocht";
const appDescription =
  "Trace hybrid race splits, find time leaks, and build a realistic next target.";
const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("ocht.theme") || localStorage.getItem("reprun.theme");
    if (theme !== "light" && theme !== "dark") {
      theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.dataset.theme = theme;
  } catch (_) {}
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: appName,
  title: {
    default: "Ocht - Hybrid Race Split Analyzer",
    template: "%s - Ocht",
  },
  description: appDescription,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/brand/ocht-mark.png",
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: appName,
    title: "Ocht - Hybrid Race Split Analyzer",
    description: appDescription,
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "Ocht hybrid race split analyzer preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ocht - Hybrid Race Split Analyzer",
    description: appDescription,
    images: ["/og-image.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7faf2" },
    { media: "(prefers-color-scheme: dark)", color: "#08100d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}

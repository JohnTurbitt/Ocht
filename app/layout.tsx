import type { Metadata, Viewport } from "next";
import { DM_Mono, Inter, Saira_Condensed } from "next/font/google";
import { ConsentedAnalytics } from "@/components/ConsentedAnalytics";
import { CookieBanner } from "@/components/CookieBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { OnboardingGate } from "@/components/OnboardingGate";
import { PremiumTierGate } from "@/components/PremiumTierGate";
import "./globals.scss";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3002";
const appName = "Ocht";
const appDescription =
  "Trace hybrid race splits, find time leaks and build a realistic next target.";
const bodyFont = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});
const displayFont = Saira_Condensed({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["600", "700", "800", "900"],
});
const monoFont = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});
const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("ocht.theme") || localStorage.getItem("reprun.theme");
    if (theme !== "light" && theme !== "dark") {
      theme = "dark";
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
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
      >
        {children}
        <OnboardingGate />
        <PremiumTierGate />
        <SiteFooter />
        <CookieBanner />
        <ConsentedAnalytics />
      </body>
    </html>
  );
}

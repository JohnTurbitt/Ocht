import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://ocht.app";

const staticRoutes = [
  "",
  "/calculations",
  "/contact",
  "/privacy",
  "/refunds",
  "/terms",
  "/what-is-hyrox",
  "/what-is-tryka",
  "/hyrox-pacing-calculator",
];

const formatGuideRoutes = new Set(["/what-is-hyrox", "/what-is-tryka"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map((route) => {
    const isHome = route === "";
    const isFormatGuide = formatGuideRoutes.has(route);

    return {
      url: `${appUrl}${route}`,
      lastModified,
      changeFrequency: isHome ? "weekly" : "monthly",
      priority: isHome ? 1 : isFormatGuide ? 0.6 : 0.5,
    };
  });
}

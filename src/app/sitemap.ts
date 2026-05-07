import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/config";

const routes = [
  {
    url: siteUrl,
    changeFrequency: "weekly" as const,
    priority: 1,
  },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    ...route,
    lastModified,
  }));
}

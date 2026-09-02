import type { MetadataRoute } from "next";

const BASE = "https://jlaero.com";

// Top US business-aviation city pairs for the programmatic route pages.
const POPULAR_ROUTES = [
  "teb-to-pbi", "teb-to-mia", "teb-to-lax", "teb-to-vny", "teb-to-aus",
  "vny-to-las", "vny-to-sjc", "vny-to-asp", "lax-to-jfk", "mia-to-jfk",
  "pbi-to-teb", "hou-to-dal", "dal-to-asp", "jfk-to-lax", "mia-to-teb",
  "las-to-vny", "sfo-to-lax", "bos-to-pbi", "iad-to-mia", "mdw-to-teb",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const statics: MetadataRoute.Sitemap = [
    "", "/charter", "/crew", "/marketplace", "/list", "/about",
    "/contact", "/help", "/terms", "/privacy",
  ].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: p === "" || p === "/charter" ? "daily" : "weekly",
    priority: p === "" ? 1 : p === "/charter" ? 0.9 : 0.5,
  }));

  const routes: MetadataRoute.Sitemap = POPULAR_ROUTES.map((r) => ({
    url: `${BASE}/routes/${r}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...statics, ...routes];
}

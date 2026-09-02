import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", "/owner", "/bookings", "/messages", "/settings",
          "/dashboard", "/onboarding", "/favorites", "/crew/me",
          "/crew/requests", "/api",
        ],
      },
    ],
    sitemap: "https://jlaero.com/sitemap.xml",
  };
}

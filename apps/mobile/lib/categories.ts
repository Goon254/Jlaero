import type { AircraftCategory } from "@jlaero/shared";

// Typical capacity per cabin class, used for the class filter and copy.
// Real aircraft data (seats, range) always wins when present.
export type CategoryMeta = {
  key: AircraftCategory;
  label: string;
  short: string;
  pax: number;
  rangeNm: number;
  blurb: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { key: "turboprop", label: "Turboprop", short: "Turboprop", pax: 6, rangeNm: 1000, blurb: "Efficient for short hops and small airfields." },
  { key: "very_light_jet", label: "Very Light Jet", short: "Very light", pax: 6, rangeNm: 1500, blurb: "Nimble jets for 1 to 2 hour flights." },
  { key: "light_jet", label: "Light Jet", short: "Light", pax: 6, rangeNm: 2000, blurb: "The most popular class for regional trips." },
  { key: "midsize_jet", label: "Midsize Jet", short: "Midsize", pax: 8, rangeNm: 2500, blurb: "Stand-up cabin, coast to coast with one stop." },
  { key: "super_midsize_jet", label: "Super Midsize Jet", short: "Super mid", pax: 10, rangeNm: 3500, blurb: "Transcontinental nonstop with a wider cabin." },
  { key: "heavy_jet", label: "Heavy Jet", short: "Heavy", pax: 16, rangeNm: 4500, blurb: "Intercontinental range with full galley and lavatory." },
  { key: "ultra_long_range", label: "Ultra Long Range", short: "Ultra long", pax: 16, rangeNm: 7500, blurb: "Anywhere to anywhere, 14+ hours nonstop." },
  { key: "airliner", label: "Airliner", short: "Airliner", pax: 50, rangeNm: 4000, blurb: "Group charter for large parties." },
  { key: "helicopter", label: "Helicopter", short: "Helicopter", pax: 6, rangeNm: 300, blurb: "City transfers and short hops." },
];

export const CATEGORY_BY_KEY = Object.fromEntries(CATEGORIES.map((c) => [c.key, c])) as Record<
  AircraftCategory,
  CategoryMeta
>;

export function categoryLabel(key: string | null | undefined): string {
  return key ? (CATEGORY_BY_KEY[key as AircraftCategory]?.label ?? key.replace(/_/g, " ")) : "Jet";
}

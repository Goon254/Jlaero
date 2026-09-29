import { supabase } from "./supabase";

export type Airport = {
  icao: string;
  iata: string | null;
  ident: string | null;
  name: string;
  municipality: string | null;
  iso_country: string | null;
};

export type AirportChoice = { code: string; label: string; manual?: boolean };

export function airportLabel(a: Airport): string {
  const city = a.municipality ? `${a.municipality}${a.iso_country ? `, ${a.iso_country}` : ""}` : "";
  return city ? `${a.name} · ${city}` : a.name;
}

export function airportCode(a: Airport): string {
  return a.iata ?? a.icao;
}

// Searches by IATA/ICAO code prefix or by airport/city name. Codes are
// ranked first, then airports with an IATA code (commercial fields).
export async function searchAirports(raw: string): Promise<Airport[]> {
  const q = raw.trim().replace(/[,()%]/g, "");
  if (q.length < 2) return [];
  const upper = q.toUpperCase();
  const { data } = await supabase
    .from("airports")
    .select("icao, iata, ident, name, municipality, iso_country")
    .or(
      `iata.ilike.${upper}%,icao.ilike.${upper}%,ident.ilike.${upper}%,name.ilike.%${q}%,municipality.ilike.%${q}%`
    )
    .order("iata", { ascending: true, nullsFirst: false })
    .limit(40);
  const rows = (data ?? []) as Airport[];
  const score = (a: Airport) => {
    if (a.iata === upper || a.icao === upper || a.ident === upper) return 0;
    if (a.iata?.startsWith(upper) || a.icao.startsWith(upper)) return 1;
    if (a.iata) return 2;
    return 3;
  };
  return rows.sort((a, b) => score(a) - score(b)).slice(0, 25);
}

export async function airportByCode(code: string): Promise<Airport | null> {
  const upper = code.trim().toUpperCase();
  if (!upper) return null;
  for (const c of [upper, upper.length === 3 ? `K${upper}` : null]) {
    if (!c) continue;
    const { data } = await supabase
      .from("airports")
      .select("icao, iata, ident, name, municipality, iso_country")
      .or(`iata.eq.${c},icao.eq.${c},ident.eq.${c}`)
      .limit(1);
    if (data?.[0]) return data[0] as Airport;
  }
  return null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Airport = {
  icao: string;
  iata: string | null;
  name: string;
  municipality: string | null;
};

export function AirportInput({
  name,
  defaultValue,
  placeholder = "Airport (code or city)",
  required = false,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState(defaultValue ?? "");
  const [code, setCode] = useState(defaultValue ?? "");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim().replace(/[^A-Za-z0-9 .-]/g, "");
    if (q.length < 2 || q === code) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("airports")
        .select("icao, iata, name, municipality")
        .or(
          `iata.ilike.${q},icao.ilike.${q}%,ident.ilike.${q}%,municipality.ilike.${q}%,name.ilike.%${q}%`
        )
        .limit(8);
      setResults((data as Airport[]) ?? []);
      setOpen(true);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pick(a: Airport) {
    setCode(a.icao);
    setQuery(`${a.iata ?? a.icao} · ${a.name}`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        required={required}
        onChange={(e) => {
          setQuery(e.target.value);
          setCode("");
        }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-ink-soft px-4 py-3 outline-none focus:border-gold"
      />
      <input type="hidden" name={name} value={code} />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-700 bg-ink-soft shadow-xl">
          {results.map((a) => (
            <li key={a.icao}>
              <button
                type="button"
                onMouseDown={() => pick(a)}
                className="flex w-full items-baseline gap-2 px-4 py-2.5 text-left text-sm hover:bg-slate-800"
              >
                <span className="font-mono text-gold">{a.iata ?? a.icao}</span>
                <span className="truncate">{a.name}</span>
                {a.municipality && (
                  <span className="ml-auto shrink-0 text-xs text-slate-500">
                    {a.municipality}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

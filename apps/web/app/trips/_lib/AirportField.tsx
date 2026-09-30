"use client";

// Airport picker for the questionnaire: search by code, name or city, never
// free-typed codes. Lux-styled version of components/AirportInput.
import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { inputClass } from "@/components/lux/ui";

type Airport = { icao: string; iata: string | null; name: string; municipality: string | null };

export function AirportField({ name, label, placeholder, required = false }: { name: string; label: string; placeholder: string; required?: boolean }) {
  const supabase = createClient();
  const id = useId();
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim().replace(/[^A-Za-z0-9 .-]/g, "");
    if (q.length < 2 || code) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("airports")
        .select("icao, iata, name, municipality")
        .or(`iata.ilike.${q},icao.ilike.${q}%,ident.ilike.${q}%,municipality.ilike.${q}%,name.ilike.%${q}%`)
        .limit(8);
      setResults((data as Airport[]) ?? []);
      setActive(0);
      setOpen(true);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, code]);

  function pick(a: Airport) {
    setCode(a.icao);
    setQuery(`${a.iata ?? a.icao} · ${a.name}${a.municipality ? `, ${a.municipality}` : ""}`);
    setOpen(false);
  }

  const listId = `${id}-list`;
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">{label}</label>
      <input
        id={id}
        value={query}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setCode("");
        }}
        onKeyDown={(e) => {
          if (!open || !results.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter") { e.preventDefault(); const a = results[active]; if (a) pick(a); }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={inputClass}
      />
      <input type="hidden" name={name} value={code} />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line-strong bg-surface shadow-xl">
          {results.map((a, i) => (
            <li key={a.icao} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={() => pick(a)}
                className={`flex min-h-[44px] w-full items-baseline gap-2 px-3.5 py-2.5 text-left text-sm ${i === active ? "bg-accent-soft" : "hover:bg-raised"}`}
              >
                <span className="font-mono font-semibold text-accent-text">{a.iata ?? a.icao}</span>
                <span className="truncate text-fg">{a.name}</span>
                {a.municipality && <span className="ml-auto shrink-0 text-xs text-fg-3">{a.municipality}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && !code && !open && <p className="mt-1 text-xs text-fg-3">Choose an airport from the list.</p>}
    </div>
  );
}

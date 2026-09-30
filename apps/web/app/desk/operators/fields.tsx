// Operator and aircraft form fields shared by the add and edit forms.
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_LABELS } from "@jlaero/shared";
import { Field, Input, Select, Textarea, type Tone } from "@/components/lux/ui";

export const NETWORK_LABELS: Record<string, string> = {
  preferred: "Preferred", approved: "Approved", prospect: "Prospect (FAA list)", excluded: "Excluded", inactive: "Inactive",
};

export const networkTone: Record<string, Tone> = { preferred: "accent", approved: "ok", prospect: "neutral", excluded: "bad", inactive: "neutral" };

type Op = Record<string, unknown> | null;
const v = (o: Op, k: string) => (o?.[k] == null ? "" : String(o[k]));

export function OperatorFields({ op, prefix = "op" }: { op: Op; prefix?: string }) {
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company name" htmlFor={id("name")}><Input id={id("name")} name="name" defaultValue={v(op, "name")} required /></Field>
      <Field label="Legal name" htmlFor={id("legal")} hint="As on the Part 135 certificate; used on contracts."><Input id={id("legal")} name="legal_name" defaultValue={v(op, "legal_name")} /></Field>
      <Field label="Part 135 certificate" htmlFor={id("cert")}><Input id={id("cert")} name="certificate_number" defaultValue={v(op, "certificate_number")} /></Field>
      <Field label="Network status" htmlFor={id("status")} hint="Only approved and preferred operators are searched first.">
        <Select id={id("status")} name="network_status" defaultValue={v(op, "network_status") || "approved"}>
          {Object.entries(NETWORK_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
      </Field>
      <Field label="Website" htmlFor={id("web")}><Input id={id("web")} name="website" defaultValue={v(op, "website")} placeholder="operator.com" /></Field>
      <Field label="Charter email" htmlFor={id("email")}><Input id={id("email")} name="general_email" type="email" defaultValue={v(op, "general_email")} placeholder="charter@operator.com" /></Field>
      <Field label="Phone" htmlFor={id("phone")}><Input id={id("phone")} name="phone" type="tel" defaultValue={v(op, "phone")} /></Field>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label="HQ city" htmlFor={id("city")}><Input id={id("city")} name="hq_city" defaultValue={v(op, "hq_city")} /></Field>
        <Field label="State" htmlFor={id("state")}><Input id={id("state")} name="hq_state" maxLength={3} defaultValue={v(op, "hq_state")} /></Field>
      </div>
      <Field label="Base airports" htmlFor={id("bases")} hint="ICAO codes, comma separated. Drives the origin and destination search.">
        <Input id={id("bases")} name="base_icaos" defaultValue={Array.isArray(op?.base_icaos) ? (op!.base_icaos as string[]).join(", ") : ""} placeholder="KTEB, KHPN" />
      </Field>
      <Field label="Service radius (miles)" htmlFor={id("radius")}><Input id={id("radius")} name="service_radius_miles" type="number" min={0} max={5000} defaultValue={v(op, "service_radius_miles")} /></Field>
      <Field label="Areas served" htmlFor={id("areas")} className="sm:col-span-2"><Textarea id={id("areas")} name="areas_served" rows={2} defaultValue={v(op, "areas_served")} placeholder="Northeast US, Florida, Caribbean" /></Field>
    </div>
  );
}

type Ac = Record<string, unknown> | null;
export function AircraftFields({ ac, prefix }: { ac: Ac; prefix: string }) {
  const id = (k: string) => `${prefix}-${k}`;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Aircraft type" htmlFor={id("type")} className="sm:col-span-2"><Input id={id("type")} name="aircraft_type" defaultValue={v(ac, "aircraft_type")} placeholder="Gulfstream G450" required /></Field>
      <Field label="Category" htmlFor={id("cat")}>
        <Select id={id("cat")} name="category" defaultValue={v(ac, "category")}>
          <option value="">Not set</option>
          {AIRCRAFT_CATEGORIES.map((c) => <option key={c} value={c}>{AIRCRAFT_CATEGORY_LABELS[c]}</option>)}
        </Select>
      </Field>
      <Field label="Manufacturer" htmlFor={id("mfr")}><Input id={id("mfr")} name="manufacturer" defaultValue={v(ac, "manufacturer")} /></Field>
      <Field label="Model" htmlFor={id("model")}><Input id={id("model")} name="model" defaultValue={v(ac, "model")} /></Field>
      <Field label="Tail number" htmlFor={id("tail")}><Input id={id("tail")} name="tail_number" defaultValue={v(ac, "tail_number")} placeholder="N123AB" /></Field>
      <Field label="Passengers" htmlFor={id("pax")}><Input id={id("pax")} name="passenger_capacity" type="number" min={1} max={100} defaultValue={v(ac, "passenger_capacity")} /></Field>
      <Field label="Range (nm)" htmlFor={id("range")}><Input id={id("range")} name="range_nm" type="number" min={0} defaultValue={v(ac, "range_nm")} /></Field>
      <Field label="Year" htmlFor={id("year")}><Input id={id("year")} name="year_mfr" type="number" defaultValue={v(ac, "year_mfr")} /></Field>
      <Field label="Home base (ICAO)" htmlFor={id("base")}><Input id={id("base")} name="home_base_icao" maxLength={4} defaultValue={v(ac, "home_base_icao")} placeholder="KTEB" /></Field>
      <Field label="Availability" htmlFor={id("avail")}>
        <Select id={id("avail")} name="availability_status" defaultValue={v(ac, "availability_status") || "unknown"}>
          <option value="available">Available</option><option value="limited">Limited</option><option value="maintenance">In maintenance</option>
          <option value="unavailable">Unavailable</option><option value="unknown">Unknown</option>
        </Select>
      </Field>
      <Field label="Special features" htmlFor={id("feat")} hint="Comma separated"><Input id={id("feat")} name="special_features" defaultValue={Array.isArray(ac?.special_features) ? (ac!.special_features as string[]).join(", ") : ""} placeholder="Wi-Fi, lavatory, pets welcome" /></Field>
      <Field label="Notes" htmlFor={id("notes")} className="sm:col-span-3"><Textarea id={id("notes")} name="notes" rows={2} defaultValue={v(ac, "notes")} /></Field>
    </div>
  );
}

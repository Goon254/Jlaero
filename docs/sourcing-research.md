# AI-driven sourcing: data, tracking, and the RFQ loop

Research and first build for the 2026-09-12 leadership direction: when a
traveler requests a jet, Jlaero should automatically find operators with
suitable aircraft near the traveler, email them a request for quote (RFQ),
parse the prices they reply with, add our margin, and present tiered offers.
Researched 2026-09-12 against live sources; prices marked "not published"
could not be verified.

## 1. The short version

- **The list exists and is free.** The FAA publishes every US aircraft
  (registry, daily) and every Part 135 charter certificate holder with the
  tail numbers on its certificate (weekly). We imported both: 28,892 US
  business jets and turboprops, 1,798 certificate holders, 5,623 aircraft
  linked to the operator that legally flies them for hire.
- **Emails are not in any public dataset.** No FAA file has email or phone.
  Contacts come from operators signing up, from manual research of their
  websites, or from B2B email-finder tools (Hunter, Apollo, Snov: free tiers,
  then $39-$149/mo). Paid aviation databases (JetNet, AMSTAT) sell contacts
  but do not publish prices.
- **Target companies, not private people.** Only a Part 135 certificate
  holder can legally sell a charter flight. A private owner's jet is almost
  always managed by such an operator, so emailing the owner is emailing the
  wrong party. Contacting companies is ordinary B2B outreach (CAN-SPAM);
  harvesting private individuals' emails and photos from a government
  registry is a privacy and reputational problem and would not get us a
  bookable aircraft anyway.
- **Current location works today, free, with caveats.** Registry gives each
  aircraft's Mode S hex code. Community ADS-B feeds return every aircraft
  within a radius of a point, including on-ground status. Our prototype
  found the business jets parked at Teterboro in one query. Caveats: hangared
  aircraft stop transmitting, rural coverage is patchy, and the free feeds'
  commercial terms are ambiguous; the licensed path is FlightAware AeroAPI
  from $100/mo.
- **The industry does RFQs through Avinode.** Brokers post a trip and
  operators quote inside the platform. Membership starts at $740/mo and the
  API is gated behind the $2,119/mo tier. Cold email to operators works but
  reply rates are unquantified and expected to be low; we should expect to
  over-fan-out and to combine email with Avinode once we can afford it.
- **Legal frame.** 14 CFR Part 295 requires a charter broker to disclose,
  before payment, that it is a broker and not the carrier, the carrier's
  name, and its insurance position. The markup model itself is normal
  brokerage; the disclosure timing shapes the offer flow.

## 2. What was built (migration 0016, scripts/sourcing)

| Piece | What it does | Result today |
|---|---|---|
| `faa-registry.mjs` | Downloads the FAA Releasable Aircraft database, keeps fixed-wing turbofan/turbojet/turboprop aircraft with 19 seats or fewer, derives a charter category, classifies the registrant (company, trust, individual) | 28,892 aircraft into `registry_aircraft`, every one with a hex code |
| `faa-part135.mjs` | Downloads the FAA Part 135 certificate-holder spreadsheet, creates one `operators` row per certificate, links each listed tail to its operator | 1,798 operators; 808 with at least one business jet or turboprop; 5,623 aircraft linked |
| `nearby.mjs KTEB 50` | Queries a live ADS-B feed for everything within the radius, joins to the registry, stores positions | Business jets on the ground at Teterboro, with tail, type, operator link, distance |
| `nearby_available_aircraft(icao, radius_nm, max_age)` | SQL function: business aircraft seen on the ground within the radius in the last N hours | Used by the future matching step |
| `operators`, `operator_contacts` | Operator profile (certificate, bases, ratings, outreach status) and business contacts with opt-out and bounce tracking | Empty contacts; filled in phase S2 |

Run order: `node scripts/sourcing/faa-registry.mjs --db`, then
`faa-part135.mjs --db`, then `nearby.mjs KXXX 50 --db`. Scripts read
`DATABASE_URL` from `apps/web/.env`. Downloads and CSV output live in
`scripts/sourcing/.cache` and `scripts/sourcing/out` (gitignored).

Registry facts worth knowing: 2,322 business aircraft are registered to
trusts (TVPX, Bank of Utah, Wilmington) that hide the beneficial owner, and
about 900 have a withheld registrant name under the 2024 FAA privacy rule.
Neither matters once we work from the operator list instead.

Largest certificate holders by business fleet: NetJets (643), Flexjet (267),
Ameriflight (95, cargo turboprops), Exclusive Jets (77), Circadian (72),
Cobalt Air (69), Guardian Flight (67, medical), Jet Select (64), Jet Linx
(62), Executive Jet Management (61), Wheels Up (46). Fractional and medical
operators are not RFQ targets; the long tail of 700 or so regional operators
with 1 to 20 aircraft is.

## 3. Data sources compared

| Source | Gives | Cost | Access | Use |
|---|---|---|---|---|
| FAA Aircraft Registry | Tail, hex, type, seats, registrant name and mailing address | Free | Daily zip | Aircraft master list (done) |
| FAA Part 135 holders list | Operator name, certificate, tails on certificate | Free | Weekly xlsx | Operator master list (done). FAA pulled it Feb to May 2026 for accuracy fixes; a few stale entries remain |
| Aircharterguide (ARGUS) | Operator directory, 2,350+ operators worldwide | Free to browse | Web only, no API or export | Manual contact research |
| ARGUS, Wyvern, ACSF registries | Safety rating per operator | Free | Web | Vetting and tiering |
| Avinode | Live availability, RFQ marketplace, empty legs | $740 / $1,058 / $2,119 per month, 6-12 month prepay; API on top tier | Vetted membership (about 30 days) | The industry RFQ channel |
| JetNet, AMSTAT | Fleet and ownership records with contacts | Not published | Sales quote | Later, if enrichment at scale is needed |
| Hunter, Apollo, Snov, RocketReach | Business emails by company domain | Free tiers; $27-$149/mo | API | Turn operator names into contacts |
| NBAA, NATA directories | Member lists | Membership | Members only | Low priority |

## 4. Aircraft positions compared

| Provider | Cost | Radius query | Shows privacy-blocked aircraft | Commercial use | Notes |
|---|---|---|---|---|---|
| adsb.lol | Free | Yes, 250 nm max | Yes | ODbL license, not prohibited | Used by the prototype |
| airplanes.live | Free | Yes | Yes | Terms silent | Returned 403 from our network |
| adsb.fi | Free | Yes | Yes | Prohibited | Do not use |
| OpenSky | Free credits | Bounding box | Mixed | Prohibited without written license | Do not use in production |
| ADS-B Exchange (RapidAPI) | $10/mo | Yes | Yes | Non-commercial only | Enterprise tier is quote-only |
| FlightAware AeroAPI | $100/mo minimum, 500k result sets | Bounding box | No (honors FAA LADD blocks) | Yes | The licensed path |
| Flightradar24 API | $9 / $90 / $900 per month | Bounding box | No | Yes | Tags business jets |

Two facts shape the design. First, Avinode itself does not use live
positions for matching: it uses operator-declared home bases and
availability calendars. Position data is an enrichment ("this Citation is
parked 12 nm from the traveler right now"), not the foundation. Second, FAA
LADD blocking mostly covers owner-flown private jets, not charter fleets that
want to be found, so a provider that honors blocks costs us little.

Poller design for phase S3: poll regional boxes (about 30 regions every 10
minutes), not individual tails; mark a position stale after 45 minutes and
fall back to the operator's base; resolve nearest airport with runway length
as a tiebreaker. Free-feed cost is zero; AeroAPI at that cadence lands around
$850-$1,600/mo and drops sharply if we only track aircraft relevant to open
requests.

## 5. The RFQ loop

Recommended stack: Postmark or Mailgun for sending plus inbound-reply
webhooks (both give structured Message-ID and In-Reply-To headers and
support a unique reply address per recipient), Claude Haiku 4.5 to classify
each reply (quote, decline, question, auto-reply), Claude Sonnet 5 with a
JSON schema to extract the quote (all-in total, currency, aircraft, FET and
fee inclusions, validity, cancellation terms, confidence).

Flow:

1. Traveler submits origin, destination, dates, passengers.
2. Matching picks operators: aircraft category fits the mission, operator
   base or a live on-ground position within radius, safety rating, prior
   responsiveness, not unsubscribed.
3. Sonnet drafts one RFQ per operator; sent from a real named mailbox with
   Reply-To `rfq+<rfq>-<recipient>@jlaero.com`, physical address and opt-out
   footer (CAN-SPAM).
4. Replies hit the inbound webhook; correlated by the reply address, then
   by In-Reply-To, then by sender address; ambiguous ones go to a human.
5. Haiku classifies; Sonnet extracts; low-confidence extractions are held
   for a human.
6. Markup engine turns an approved operator quote into a traveler offer per
   tier (percent or flat, set by policy). Operator $4,000 to traveler $6,000
   is a 50% markup; industry commentary ranges 3% to 30%, so the policy is a
   business decision, and 7.5% federal excise tax plus $5.30 per-segment fee
   apply on domestic charter (collected by the operator).
7. Traveler sees tiered offers; on acceptance, Part 295 disclosure step
   (broker status, carrier name, insurance), then payment.
8. Operator confirmation email drafted by AI, approved by a human, sent.
   Every generated email and extraction is written to the audit log.

Tables for phase S4: `rfqs`, `rfq_recipients`, `rfq_messages`,
`operator_quotes`, `traveler_offers` (schema sketch in the S4 roadmap item).

Guardrails: no automated email that commits money or names a carrier goes
out without approval in the first months; extraction confidence gates offers;
audit log on everything.

## 6. Photos

No public source of aircraft photos is free to reuse commercially. JetPhotos
and Planespotters photos belong to the photographers; manufacturer press
images are editorial-use only. Wikimedia Commons images with CC-BY licenses
work with attribution. The clean path is the operator's own photos with
written permission, collected at onboarding. Photos of the people who own
jets are out of scope: they are private individuals and not our
counterparties.

## 7. Decisions (taken 2026-09-12)

1. Markup: flexible, to beat competitors (leadership). Implemented as
   per-tier policy defaults with a per-offer override and a competitor-beat
   mode that never drops below the tier's minimum margin.
2. Privacy-blocked aircraft: only aircraft on a Part 135 certificate are
   matched or tracked, so privately owned, privacy-blocked jets never enter
   the system. Charter fleets want to be found.
3. Avinode: after first revenue. Email RFQs plus operator sign-ups first.
4. Launch regions: New York metro, South Florida, Southern California,
   Texas, Chicago. `scripts/sourcing/targets.mjs` ranks the operators to
   research in each.
5. Sender identity: a named desk mailbox ("Jlaero Charter Desk") sent
   through Postmark, with a unique reply address per operator so replies
   thread back automatically.

Build status is tracked in ROADMAP.md, "DIRECTION UPDATE 2".

## 8. Sources

FAA registry: https://registry.faa.gov/database/ReleasableAircraft.zip and
https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download.
FAA Part 135 holders: https://www.faa.gov/about/officeorg/headquartersoffices/avs/faa-certificated-aircraft-operators-legal-part-135-holders.
Avinode pricing: https://avinode.com/pricing/ and https://developer.avinodegroup.com/docs/api-basics.
AeroAPI: https://www.flightaware.com/commercial/aeroapi/. ADS-B Exchange:
https://www.adsbexchange.com/data-products/. FAA LADD: https://www.faa.gov/pilots/ladd.
Part 295: https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295.
CAN-SPAM: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business.
FET rates 2026: https://nata.aero/icymi-irs-announces-2026-fet-rates/.
Claude pricing and structured outputs: https://platform.claude.com/docs/en/about-claude/pricing,
https://platform.claude.com/docs/en/build-with-claude/structured-outputs.
Postmark inbound: https://postmarkapp.com/developer/webhooks/inbound-webhook.
Mailgun routes: https://www.mailgun.com/features/inbound-email-routing/.

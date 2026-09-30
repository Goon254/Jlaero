# Private Aviation Booking App: Front-End & Back-End Workflow Summary

Received from leadership 2026-09-29. Source of truth for the brokerage workflow.
Condensed formatting; content is complete. Companion: `02-technical-blueprint.md`.

## 1. App purpose

Make private aviation booking faster for the broker, easier and more transparent
for the client, less manual, easier to compare aircraft and pricing, automated
where possible while keeping the broker involved for important decisions.

A client submits a trip request, receives charter options, selects one,
completes contract and payment, then manages the trip in the app. The broker /
company has a separate backend dashboard for requests, quotes, contracts,
payments, operators, and active trips.

## 2. High-level workflow

Client Request -> AI Searches Operators -> Quotes Collected -> Pricing/Markup ->
Client Receives Options -> Client Selects Option -> Contract -> Payment ->
Broker Confirms Operator -> Operator Sends Itinerary -> Company Itinerary ->
Trip Tracking -> Trip Completed -> Feedback

## 3. Front end: client experience

**Step 1: Trip request.** Option A: client emails a request; the system
recognizes it and creates a trip inquiry. Option B: in the app, "Request a
Charter". Both must create the same trip request in the backend.

**Step 2: Questionnaire.**
- Client info: name, company (if applicable), email, phone.
- Trip info: aircraft type requested, departure location, destination,
  departure date, departure time, return date/time (if applicable), passengers.
- Additional services: vehicle service yes/no, catering yes/no.
- Private aviation experience: first time flying private? yes/no.
- Special requests (free text): pets, special catering, specific aircraft,
  luggage, wheelchair/accessibility, specific airport, other passenger needs.
- Submit button: **"Get Charter Options"**; request goes to the backend.

## 4. Back end: AI quote search

On submit the backend creates a new trip inquiry. AI/automation uses the request
to search aircraft availability and pricing.

**Operator database** (company provides): operator names, websites, emails,
contact info, areas served, aircraft info, other data. Maintained in-system.

**Step 5: AI operator search** based on departure, destination, aircraft type,
passenger count, date, departure time, other requirements. Geographic search:
operators at the origin + destination + ~100-mile radius; **radius configurable**.

## 5. Quote collection

Collect quotes from participating operators, automated where possible (APIs,
operator websites, email integrations, approved portals, other sources). Without
automation, the broker **manually enters** the quote. Every quote must be clearly
marked **AI/Automatically Received** or **Manually Entered by Broker** so the
broker can verify before presenting.

## 6. AI pricing / markup

Client price = Operator Quote + Company Markup. **Default markup 10%**,
configurable by an authorized admin. Example: $20,000 + 10% ($2,000) = $22,000.
If selected, add vehicle service pricing and catering pricing. The broker sees
the breakdown before the quote is sent to the client.

## 7. Client quote options

Up to **3 suitable options**, shown as a simple comparison (aircraft,
passengers, route, estimated price), e.g. Gulfstream G450 / Challenger 350 /
Citation X. Client can open an option for more info. Options are described as
**estimated quotes** until broker/operator verify availability and pricing.

## 8. Client selects an option

"**Select This Aircraft**" -> backend; broker notified. Broker can review the
selection, verify quote, verify availability, make changes, approve, send back
to client.

## 9. Contract generation

Once approved, the system auto-generates a contract from the company's template
(company provides it), filling client name, company, trip date, aircraft,
route, passenger count, price, additional services, cancellation terms, other
trip info. Client reviews, signs, submits in the app. Signed contract stored.

## 10. Payment

After signing, client goes to payment: credit card, ACH, wire transfer, direct
deposit, to the company's designated account. **The trip is NOT confirmed by
selecting an aircraft or signing. It is confirmed only after required payment is
received and verified.**

## 11. Back end: payment processing

Verification may initially be a manual broker function. Dashboard shows payment
status: Pending, Payment Received, Payment Verified, Payment Failed, Refunded.
Once verified: Trip Status = Ready for Operator Confirmation. Broker then pays
the operator.

## 12. Operator confirmation

Broker sends payment + trip info to operator. Track: operator, aircraft, crew,
payment, trip date, confirmation status, operator contact, operator
confirmation number. Operator confirms -> Trip Status = Confirmed.

## 13. Operator itinerary

Operator sends official itinerary; broker uploads/enters it. System creates a
client-facing itinerary with company branding/logo. Client receives it via app,
email, and downloadable document/PDF.

## 14. Trip countdown

From 72 hours before departure the client sees a countdown (e.g. "YOUR TRIP
Miami -> New York, Departure Friday September 25 3:30 PM"; 72h -> 48h -> 24h ->
Departure), updating automatically.

## 15. 72-hour cancellation reminder

At ~72h the app notifies: "Your trip is approaching. Your scheduled departure is
within 72 hours. Please review the cancellation policy before making any changes
to your trip." Company-provided cancellation policy is in the app and viewable.

## 16. Live flight tracking

When the trip is active: aircraft, current location, departure, destination,
ETA, flight status. Built in or via an external tracking provider/API (decided
during development).

## 17. Aircraft maintenance / AOG workflow

If the operator reports maintenance issue, AOG, mechanical issue, aircraft
unavailable, crew issue, or other operational problem, the backend flags the
trip immediately: **Operational Issue - Replacement Required**.

## 18. AI rebooking search

AI reuses the original trip info (departure, destination, date, time,
passengers, aircraft requirements, special requests, vehicle, catering, other)
to search operators again and generate replacement options. **AI must NOT send
replacements to the client automatically**: AI -> Broker Dashboard -> Broker
Reviews -> Broker Approves -> Client Receives Options.

## 19. Client approval of replacement

Broker presents replacement options; client selects; system updates aircraft,
operator, price, itinerary, trip info; broker confirms the new aircraft with the
operator.

## 20. Trip completion

Trip Status = Completed; automatic thank-you: "Thank you for flying with us. We
appreciate the opportunity to assist with your trip."

## 21. Client feedback

Feedback request after the trip: 1-5 star rating, comments ("What did you think
about your experience?"), optional categories: booking experience,
communication, aircraft, crew, ground transportation, catering, overall. Stored
for management review.

## 22. Broker / admin dashboard

One central dashboard of all active and historical trips. Statuses: New Request,
Searching for Quotes, Quotes Received, Broker Review, Options Sent to Client,
Client Selected, Contract Sent, Contract Signed, Payment Pending, Payment
Received, Operator Confirmation Pending, Trip Confirmed, Itinerary Received,
Trip Within 72 Hours, Trip Active, Trip Completed, Feedback Requested, Closed.
Exception: Operational Issue / Replacement Required.

## 23. Broker dashboard functions

- Client management: client info, trip history, previous requests.
- Trip management: create/edit trip, status, modify info, notes, assign broker,
  view communications.
- Quote management: view operator quotes, add manual quotes, edit pricing,
  adjust markup, compare operators, approve quotes, send options.
- Contract management: generate, send, view signed, download.
- Payment management: view status, manually verify, record operator payment,
  upload payment confirmation.
- Operator management: view database, add/edit operators, email/website,
  aircraft info, track operator responses.
- Trip operations: upload operator itinerary, generate branded itinerary, send
  to client, monitor trip, handle AOG/replacement.

## 24. AI assists, does not control

AI CAN: read incoming requests, extract trip info from emails, search approved
operator sources, collect/organize quotes, calculate markup, add services,
identify aircraft options, generate quote options, generate contracts from
approved templates, monitor trip status, identify operational issues, search
replacements, draft client communications, generate itinerary info, send
automated reminders.

BROKER CONTROLS: final quote approval, final aircraft/operator selection,
contract approval, payment verification, operator payment, client communication
when needed, replacement approval, major pricing changes, exceptions/unusual
requests. Human-in-the-loop.

## 25. Notifications

Client: email, app, SMS (later). Broker: email, dashboard, app, SMS if needed.
Events: new trip request, quotes received, client selected aircraft, contract
signed, payment received, operator confirmation, itinerary received, 72-hour
reminder, aircraft/operator issue, replacement options available, trip
completed, feedback received.

## 26. Core records

- CLIENT: name, company, email, phone, trip history, preferences.
- TRIP: trip ID, client, origin, destination, date, time, passengers, aircraft
  requirements, special requests, services, status.
- OPERATOR: company name, website, email, phone, service area, aircraft,
  integration type, availability/quote history.
- AIRCRAFT: type, tail number, operator, capacity, range, location, availability.
- QUOTE: operator, aircraft, operator price, markup, additional services, client
  price, quote status, expiration.
- CONTRACT: trip ID, client, version, status, signature, signed date.
- PAYMENT: trip ID, amount, method, status, date received, operator payment status.
- ITINERARY: operator itinerary, company itinerary, client delivery status.
- FEEDBACK: rating, comments, date, trip ID, client.

## 27. Architecture

Front end: Client App -> Trip Request -> Questionnaire -> Quote Options ->
Contract -> Payment -> Trip Dashboard -> Itinerary -> Tracking -> Feedback.

Back end: Admin/Broker Dashboard -> Trip Management -> AI Quote Engine ->
Operator Database -> Operator Communication/Integrations -> Pricing Engine ->
Contract System -> Payment System -> Itinerary System -> Flight Tracking ->
Notification System -> Client/Trip Database.

## 28. Primary sequence

1 client requests trip, 2 system creates Trip ID, 3 AI reads requirements, 4 AI
searches approved operators, 5 quotes collected, 6 markup applied, 7 services
added, 8 up to 3 options produced, 9 broker reviews/approves, 10 client receives
options, 11 client selects, 12 contract generated, 13 client signs, 14 client
submits payment, 15 payment verified, 16 broker pays operator, 17 operator
confirms, 18 operator sends itinerary, 19 branded itinerary generated, 20 client
receives itinerary, 21 72-hour countdown/reminder, 22 live tracking, 23 trip
completed, 24 thank-you, 25 rating/feedback, 26 trip closed.

## 29. Exception workflow: aircraft problem

Operator reports AOG/maintenance -> system flags trip -> AI reads original
requirements -> AI searches replacements -> options to broker -> broker reviews
-> broker presents approved options to client -> client selects -> broker
confirms with operator -> itinerary updated -> client receives updated
itinerary -> trip continues.

## 30. Development priority

- **Phase 1 (core MVP):** client questionnaire, trip request creation, broker
  dashboard, operator database, manual quote entry, AI-assisted quote
  organization, 10% markup, 3-option presentation, client selection, contract
  generation/signature, payment status, operator confirmation, itinerary
  upload, client trip dashboard, 72-hour reminder, feedback.
- **Phase 2 (automation):** operator email integrations, automated quote
  collection, AI operator search, automated pricing, automated client
  notifications, flight tracking, automated itinerary generation, AI
  replacement search.
- **Phase 3 (advanced):** direct operator APIs, automated availability checks,
  automated payment processing, automated operator payments, advanced client
  profiles/preferences, CRM, analytics, operator performance tracking, automated
  follow-up, more advanced AI.

## 31. Key principle

AI handles repetitive research and organization; the broker stays in control of
important decisions. The client sees a simple professional experience. The
broker has full visibility: where the request is, which operators were
contacted, what quotes came back, how pricing was calculated, what the client
selected, whether the contract was signed, whether payment was received,
whether the operator confirmed, what happens before/during/after the flight.

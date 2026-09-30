# Private Aviation Booking App: Technical Development Blueprint

Received from leadership 2026-09-29. Condensed formatting; content is complete.
Companion: `01-workflow-summary.md`. How we implement it: `03-implementation.md`.

## 1. Four layers

1. **Client app:** login, charter request, quote viewing, contract/signature,
   payment, itinerary, trip tracking, notifications, feedback.
2. **Broker/admin dashboard:** trip, quote, operator, client, payment,
   itinerary management; operational alerts; AI recommendations.
3. **AI/automation engine:** request parsing, operator search, quote
   collection, quote normalization, pricing, replacement search, notifications,
   document generation.
4. **Database + external services:** clients, trips, operators, aircraft,
   quotes, contracts, payments, itineraries, communications, flight tracking,
   notifications.

## 2. Roles

- **Client** can: manage profile, submit requests, view quotes, select aircraft,
  sign contracts, pay, view itineraries, track trips, submit feedback. Cannot:
  view other clients, view operator pricing/cost, change markup, approve
  operators, change internal trip info.
- **Broker** can: view assigned trips, review quotes, add manual quotes, modify
  client-facing pricing, communicate with operators, send quotes, manage
  contracts, verify payments, upload itineraries, manage active trips, handle
  aircraft changes.
- **Admin** = broker plus: manage users, operators, aircraft, markup settings,
  integrations, contract templates, cancellation policies, financial reports,
  system logs, automation config.
- **Finance** can: view payments, verify payments, record operator payments,
  view financial info. Not necessarily client communication or operations.

## 3. Tables (conceptual)

- USERS: user_id, first/last name, email, phone, auth id, role, status,
  created_at, last_login.
- CLIENTS: client_id, user_id, company_name, preferred_contact_method,
  first_time_private_flyer, notes, created/updated_at.
- TRIPS: trip_id, client_id, broker_id, status, origin, destination,
  departure_date, departure_time, return_date, return_time, passenger_count,
  aircraft_preference, vehicle_required, catering_required, special_requests,
  created/updated_at. Unique human Trip ID, e.g. `TRIP-2026-000145`.

## 4. Trip status system (controls what happens next; build triggers on it)

NEW_REQUEST, SEARCHING, QUOTES_RECEIVED, BROKER_REVIEW, OPTIONS_SENT,
CLIENT_SELECTED, CONTRACT_SENT, CONTRACT_SIGNED, PAYMENT_PENDING,
PAYMENT_RECEIVED, OPERATOR_CONFIRMATION_PENDING, CONFIRMED, ITINERARY_PENDING,
ITINERARY_READY, WITHIN_72_HOURS, ACTIVE, OPERATIONAL_ISSUE,
REPLACEMENT_SEARCH, REPLACEMENT_PENDING_CLIENT, COMPLETED, FEEDBACK_REQUESTED,
CLOSED, CANCELLED.

## 5. Operators

operator_id, company_name, website, email, phone, location, service_radius,
api_available, email_integration, website_integration, status, notes,
created/updated_at. Example: ABC Aviation, operatorwebsite.com,
charter@operator.com, API no, email integration yes.

## 6. Aircraft

aircraft_id, operator_id, aircraft_type, manufacturer, model, tail_number,
passenger_capacity, range, home_base, availability_status, special_features,
notes. Example: Gulfstream G450, ABC Aviation, capacity 14, home base TEB.

## 7. Quotes (every operator response is a quote record)

quote_id, trip_id, operator_id, aircraft_id, operator_cost, markup_percentage,
markup_amount, catering_cost, vehicle_cost, other_cost, client_price, currency,
availability_status, quote_expiration, source, quote_status, created_at.
SOURCE: API, EMAIL, WEBSITE, MANUAL, AI_EXTRACTED (tracks reliability).

## 8. Pricing engine

Client Price = Operator Cost + Company Markup + Catering + Vehicle + Other
Approved Fees. Default markup 10%, **not hard-coded**, admin-changeable.
Example: 20,000 + 2,000 (10%) + 500 catering + 750 vehicle = **23,250**. Store
both operator cost and client price; client sees only client-facing pricing.

## 9. AI quote workflow

At SEARCHING the AI receives a structured request (trip ID, origin, destination,
date, departure time, passengers, aircraft class, catering, vehicle, special
requests) and searches the approved operator network.

## 10. Operator search logic

1 operators at/near origin; 2 at/near destination; 3 approved operators within
configurable radius (default 100 miles); 4 check aircraft requirements; 5 check
availability; 6 request pricing; 7 collect responses; 8 normalize quotes.

## 11. Operator integration types

- A. API: App -> API -> Operator -> API -> App (best when available).
- B. Email: structured email (Aircraft Request: Trip ID, origin, destination,
  date, time, passengers, aircraft); operator replies; AI extracts aircraft,
  availability, price, restrictions, additional fees; creates a quote.
- C. Manual: broker enters operator, aircraft, price, availability, notes.
  **Always available.**

## 12. AI quote extraction

"G450 available for your requested date. Charter price is $20,000. Catering
additional. Vehicle available through our preferred provider." becomes
Aircraft G450, Available YES, Operator Cost 20,000, Catering Additional, Vehicle
Available, Source EMAIL, Verification **PENDING BROKER REVIEW**. Broker approves.

## 13. AI safety rule

AI must not confirm aircraft, operator, final pricing, payment, or replacement
aircraft without broker approval. AI recommends and organizes; broker decides.

## 14. Three-option engine

Filter on availability, aircraft requirements, capacity, route suitability,
price, operator response, special requirements. Up to 3 client-facing options.
Broker approves before sending.

## 15. Quote API (conceptual)

`POST /trips/{trip_id}/quotes/search` -> `{ trip_id, status: "quotes_received",
options: [{ quote_id, aircraft, client_price }] }`. Exact API is the developer's call.

## 16. Client selection

Client selects quote_id -> quote_status = CLIENT_SELECTED, trip_status =
CLIENT_SELECTED, broker notified "Client selected an aircraft."

## 17. Contract system

Templates stored separately: contract_template_id, version, effective_date,
document_location, status. Generated contract: trip_id, client_id, quote_id,
contract_template, contract_version, signed_document, signature_status,
signed_at. **Version-controlled**: an old contract is never overwritten by a
newer template.

## 18. E-signature

Client Selection -> Contract Generated -> Client Reviews -> Client Signs ->
Signed Document Stored -> Payment Enabled. Use a proper e-signature provider
rather than a custom system unless there is a specific reason.

## 19. Payment record

payment_id, trip_id, client_id, amount, currency, payment_method,
payment_status, transaction_id, submitted_at, verified_at, verified_by.
Methods: CREDIT_CARD, ACH, WIRE, DIRECT_DEPOSIT.

## 20. Payment status

PENDING, SUBMITTED, RECEIVED, VERIFIED, FAILED, REFUNDED, CANCELLED.
Contract Signed != Trip Confirmed. Confirmation requires Contract Signed +
Payment Verified + Operator Confirmation.

## 21. Operator payment (separate record)

operator_payment_id, trip_id, operator_id, amount, payment_method, status,
payment_date, confirmation_reference.

## 22-23. Itineraries (never overwrite versions)

Operator itinerary: operator_itinerary_id, trip_id, document, received_at.
Company itinerary: client_itinerary_id, trip_id, version, document, created_at,
sent_at. E.g. v1 G450, v2 replacement Challenger 650. Client sees only the
current itinerary; broker/admin see full history.

## 24. Notification engine

notification_id, user_id, trip_id, type, channel (APP, EMAIL, SMS), message,
status, sent_at. Types: NEW_QUOTE, CLIENT_SELECTED, CONTRACT_READY,
CONTRACT_SIGNED, PAYMENT_RECEIVED, TRIP_CONFIRMED, ITINERARY_READY,
72_HOUR_REMINDER, OPERATIONAL_ALERT, REPLACEMENT_AVAILABLE, TRIP_COMPLETED,
FEEDBACK_REQUEST.

## 25. 72-hour automation

If departure - now <= 72h and not yet sent: trigger 72_HOUR_REMINDER, set
WITHIN_72_HOURS, send client countdown, cancellation reminder, itinerary link.

## 26. Flight tracking

Approved provider feeds position, status, departure, ETA, arrival. Client gets
simplified info; broker gets detailed operational info.

## 27-28. AOG / replacement

Operator sends AIRCRAFT_UNAVAILABLE -> OPERATIONAL_ISSUE -> broker URGENT ALERT
-> AI loads original requirements and searches -> REPLACEMENT OPTIONS -> broker
review -> options to client -> client selects -> broker confirms -> operator
confirms -> itinerary updated -> client notified. Old aircraft/itinerary stays
in history.

## 29. AI roles (separate instructions per job)

1. Request parser: email/questionnaire -> structured trip data incl. Missing
   Information.
2. Operator search: operator, aircraft, availability, price, source, response
   time, restrictions.
3. Quote normalizer: different responses -> same format.
4. Pricing assistant: apply markup/services; **deterministic backend code does
   the math**, not the LLM.
5. Client communication: draft simple client messages.
6. AOG assistant: replacement search from original requirements.

## 30. Audit log

TIME, USER, ACTION, OLD VALUE, NEW VALUE (e.g. "Broker John changed client price
22,000 -> 23,250"). Also: quote edited, aircraft changed, contract generated,
contract signed, payment verified, operator payment recorded, itinerary
changed, client notified.

## 31. Permissions

Broker: create/review/send quote. Senior broker/admin: change markup, override
pricing, approve exceptions. Finance: verify payment, record operator payment.

## 32. Data flow

Client -> Questionnaire -> Trip DB -> AI -> Operator DB -> APIs/Email/Websites
-> Quote DB -> Pricing Engine -> Broker Review -> Client -> Contract -> Payment
-> Broker -> Operator -> Itinerary -> Client -> Tracking -> Completed -> Feedback.

## 33. Automated vs manual

| Function | Automation | Human |
|---|---|---|
| Read client request | Yes | Review if needed |
| Extract trip info | Yes | Correct if needed |
| Search operators | Yes | Review |
| Collect quotes | Yes where possible | Manual fallback |
| Calculate markup | Yes | Approve |
| Select final options | AI recommends | Broker approves |
| Contract generation | Yes | Review if needed |
| Contract signature | Yes | Client |
| Payment processing | Yes where possible | Verify |
| Operator payment | No/manual initially | Broker/Finance |
| Operator confirmation | Assisted | Broker |
| Itinerary creation | Yes | Approve |
| 72-hour reminder | Yes | - |
| Flight tracking | Yes | Monitor |
| AOG detection | Yes | Broker handles |
| Replacement search | Yes | Broker approves |
| Client notification | Yes | Broker can override |
| Feedback collection | Yes | Review |

## 34. Admin settings

- Pricing: default markup %, minimum markup, service fees, vehicle pricing,
  catering pricing.
- Search: radius, preferred operators, excluded operators, aircraft categories.
- Contract: templates, versions, cancellation policy, payment terms.
- Notifications: email/SMS templates, push, 72-hour reminder timing.
- Operators: add/edit, integration credentials, status, search priority.

## 35. Future integrations (no provider lock-in)

Payment processor, e-signature, flight tracking, email, SMS, maps, accounting,
CRM, operator APIs.

## 36. Security

Secure auth, role-based permissions, encryption, secure document storage,
compliant payment provider (never store raw card data), audit logs, API auth,
session management, backup/recovery, admin access controls.

## 37. Build order

1. Database -> auth -> client app -> broker dashboard -> trip management.
2. Operator database -> quote management -> pricing engine -> client quote screen.
3. Contract generation -> e-signature -> payment -> payment verification.
4. Itinerary -> notifications -> 72-hour automation -> client trip dashboard.
5. Operator integrations -> AI quote search -> email parsing -> automated quote
   collection.
6. Flight tracking -> AOG detection -> AI replacement search -> advanced automation.

## 38. Success criteria

Broker takes a trip REQUEST -> QUOTE -> CONTRACT -> PAYMENT -> CONFIRMATION ->
ITINERARY -> FLIGHT -> COMPLETION without moving info between systems by hand.
Client: REQUEST -> CHOOSE -> SIGN -> PAY -> FLY.

## 39. Most important rule

A broker-assisted automation platform, not an AI that books aircraft by itself.
AI: find -> organize -> calculate -> recommend -> notify -> monitor. Broker:
verify -> approve -> communicate -> decide. Client: request -> review -> select
-> sign -> pay -> travel. Reflect this in the database, permissions, API, AI
prompts, and UI from the beginning.

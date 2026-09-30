-- Staff roles for the broker-assisted workflow (docs/specs/02-technical-blueprint.md s2, s31).
-- Kept in its own migration: new enum values cannot be used in the same
-- transaction that adds them.
--   broker  : runs trips, quotes, contracts, itineraries
--   finance : verifies client payments, records operator payments
--   admin   : everything, plus settings, templates, users
alter type app_role add value if not exists 'broker';
alter type app_role add value if not exists 'finance';

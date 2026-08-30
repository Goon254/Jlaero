# Jlaero

**The marketplace for private aviation** — charter jets, hire pilots & crew, and
buy or sell aircraft. Web app + mobile app. "Uber for private jets."

See [`PLAN.md`](./PLAN.md) for the product & architecture plan, and
[`MIGRATION.md`](./MIGRATION.md) for notes on retiring the old WordPress site.

## Stack

- **Web:** Next.js (App Router) + Tailwind
- **Mobile:** Expo / React Native *(coming next)*
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage, RLS)
- **Payments:** Stripe Connect (marketplace)
- **Monorepo:** pnpm workspaces + Turborepo, shared types in `packages/shared`

## Layout

```
apps/
  web/            Next.js web app
  mobile/         Expo app (coming next)
packages/
  shared/         Types, Zod schemas, domain constants (used by web + mobile)
supabase/
  migrations/     Database schema + RLS + storage buckets
  config.toml     Local Supabase config
site/             Legacy WordPress mirror (reference only; core is gitignored)
```

## Getting started

Prereqs: Node 20+ and pnpm 9. **No Docker needed** — we use a hosted Supabase
project as the database.

### Option A — Cloud Supabase (recommended, no Docker)

1. Create a project at https://supabase.com → copy the Project URL, anon key,
   and service_role key from **Settings → API**.
2. Put them in `apps/web/.env` (see `.env.example`).
3. Apply the schema to your cloud project with the Supabase CLI:
   ```bash
   pnpm dlx supabase login
   pnpm dlx supabase link --project-ref <your-project-ref>
   pnpm dlx supabase db push        # runs supabase/migrations
   ```
4. Run it:
   ```bash
   pnpm install
   pnpm dev                          # -> http://localhost:3000
   ```

### Option B — Local Supabase (needs Docker)

Only if you want an offline, resettable local database:

```bash
pnpm db:start     # local Postgres/auth/storage; Studio at :54323
pnpm db:reset     # apply migrations
pnpm db:types     # regenerate typed DB types into packages/shared
pnpm dev
```

## Environment

Secrets live in `.env` files (gitignored). See `.env.example` for the keys.
The old hosting/site logins are in `CREDENTIALS.md` (gitignored).

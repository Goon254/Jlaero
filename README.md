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

Prereqs: Node 20+, pnpm 9, and the [Supabase CLI](https://supabase.com/docs/guides/cli)
+ Docker (for local Supabase).

```bash
pnpm install

# start local Supabase (Postgres, auth, storage, studio)
pnpm db:start          # -> Studio at http://localhost:54323
pnpm db:reset          # apply migrations in supabase/migrations

# generate typed DB types into packages/shared
pnpm db:types

# copy env and fill in the values printed by `supabase start`
cp apps/web/.env.example apps/web/.env

# run the web app
pnpm dev               # -> http://localhost:3000
```

## Environment

Secrets live in `.env` files (gitignored). See `.env.example` for the keys.
The old hosting/site logins are in `CREDENTIALS.md` (gitignored).

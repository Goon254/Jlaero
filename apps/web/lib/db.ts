import postgres from "postgres";

// Direct Postgres connection for trusted server-side paths that have no user
// session (Stripe webhooks). Bypasses RLS; use ONLY in webhook handlers and
// keep every query scoped by ids taken from verified Stripe events.
let sql: ReturnType<typeof postgres> | null = null;

export function db() {
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL!, {
      max: 2,
      idle_timeout: 20,
      prepare: false, // required for connection poolers
    });
  }
  return sql;
}

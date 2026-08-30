-- Phase 3 engine plumbing: expiries via pg_cron, realtime for messages.

-- Realtime: stream new messages to conversation participants.
alter publication supabase_realtime add table messages;

-- Expiry sweep. Idempotent and safe to run any time.
create or replace function run_expiries()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Sent quotes past their expiry
  update quotes set status = 'expired'
    where status = 'sent' and expires_at is not null and expires_at < now();

  -- Quoted bookings with no live quote fall back to requested (ROADMAP 3b)
  update bookings b set status = 'requested'
    where b.status = 'quoted'
      and not exists (
        select 1 from quotes q where q.booking_id = b.id and q.status = 'sent'
      );

  -- Accepted holds not signed within 24h expire and free the calendar
  update bookings set status = 'expired', occupied_from = null, occupied_to = null
    where status = 'accepted' and updated_at < now() - interval '24 hours';

  -- Stale requests and negotiations expire after 14 days
  update bookings set status = 'expired'
    where status in ('requested', 'negotiating')
      and updated_at < now() - interval '14 days';
end $$;

revoke execute on function run_expiries() from public, anon;
-- authenticated may trigger the sweep early; it is a harmless idempotent
-- maintenance task and having it callable keeps it testable end to end.
grant execute on function run_expiries() to authenticated, service_role;

-- Run every 15 minutes.
create extension if not exists pg_cron;
select cron.schedule('jlaero-expiries', '*/15 * * * *', $$select public.run_expiries()$$);

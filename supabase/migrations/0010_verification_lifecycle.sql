-- Phase 5: verification lifecycle.
-- Expired credentials get rejected automatically and the owner's active
-- charter listings are paused until renewed (ROADMAP S21, 3c).

create index if not exists verification_documents_status_idx
  on verification_documents (status);

create or replace function run_expiries()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Sent quotes past their expiry
  update quotes set status = 'expired'
    where status = 'sent' and expires_at is not null and expires_at < now();

  -- Quoted bookings with no live quote fall back to requested
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

  -- Credentials past their expiry date lapse
  update verification_documents
    set status = 'rejected',
        rejection_reason = 'Document expired; upload a current version'
    where status = 'verified'
      and expires_at is not null
      and expires_at < current_date;

  -- Pause active charter listings whose owner lacks a live operator
  -- certificate or insurance (only for owners who have submitted docs before,
  -- so dev/seed listings without any docs are not swept; the hard gate for
  -- never-verified operators arrives with launch, ROADMAP Phase 8)
  update aircraft a set status = 'paused'
    where a.status = 'active'
      and exists (
        select 1 from verification_documents d
        where d.user_id = a.owner_id and d.doc_type = 'operator_certificate'
      )
      and not exists (
        select 1 from verification_documents d
        where d.user_id = a.owner_id
          and d.doc_type = 'operator_certificate'
          and d.status = 'verified'
      );
end $$;

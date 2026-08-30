-- Bug fix: the creator of a booking conversation could not read it back
-- (insert ... returning failed) because they are not yet a participant when
-- RLS evaluates. Booking parties may always see their booking's conversation.
create policy "booking party reads conversation" on conversations for select to authenticated
  using (booking_id is not null and is_booking_party(booking_id));

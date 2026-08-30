-- Distinguish owner blocks from maintenance blocks on availability ranges.
create type block_kind as enum ('owner', 'maintenance');

alter table aircraft_availability
  add column kind block_kind not null default 'owner';
alter table crew_availability
  add column kind block_kind not null default 'owner';

-- Entry fee on tournaments (in cents, e.g. 5000 = $50.00)
alter table tournaments
  add column if not exists entry_fee integer default 0 check (entry_fee >= 0);

-- Payment tracking on players
alter table players
  add column if not exists payment_status text default 'free'
    check (payment_status in ('free', 'pending', 'paid', 'refunded', 'waived'));

alter table players
  add column if not exists stripe_session_id text;

create index if not exists idx_players_stripe_session
  on players(stripe_session_id)
  where stripe_session_id is not null;

create index if not exists idx_players_payment_status
  on players(payment_status);

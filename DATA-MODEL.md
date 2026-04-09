# Data Model — Supabase Schema

Current as of April 2026. Run migrations in `supabase/` to keep in sync.

---

## tournaments

Top-level container. One per event.

```sql
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,

  -- Dates
  start_date date not null,
  end_date date,

  -- Status
  status text default 'upcoming' check (status in ('upcoming', 'active', 'completed')),

  -- Venue
  venue text,
  address text,
  location_city text,            -- e.g. "Seattle, Washington"
  court_count int default 4,

  -- Display / classification
  category text,                 -- e.g. "Open/Adult", "Junior"
  description text,

  -- Hero appearance
  image_url text,                -- small square graphic/logo (hero corner + cards)
  hero_image_url text,           -- full-width background photo for the hero banner
  hero_gradient text,            -- key from GRADIENT_PRESETS (default: 'navy')
  hero_text_color text,          -- key from TEXT_COLOR_PRESETS (default: 'white')
  hero_overlay text default 'true', -- 'true'/'false' — dark tint over background image

  -- Contact
  contact_name text,
  contact_email text,
  contact_phone text,

  -- Schedule milestone dates
  registration_opens date,
  registration_deadline date,
  draw_lock_date date,
  entry_close_date date,

  -- Info accordion sections (shown on public landing page)
  info_latest text,
  info_accommodations text,
  info_entry text,
  info_rules text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## courts

Physical courts per tournament.

```sql
create table courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,            -- "Court 1", "Show Court", etc.
  sort_order int default 0,
  status text default 'available'
    check (status in ('available', 'in_use', 'maintenance')),
  created_at timestamptz default now()
);
```

---

## players

Tournament participants. No auth required — found by name or direct link.

```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  seed int,
  club text,
  email text,
  phone text,
  draw text,                     -- "Open", "B", "C", "Women's"
  created_at timestamptz default now()
);
```

**Note:** When a player with an email is added via the API, they are automatically upserted into `email_recipients` with `type = 'player'`.

---

## matches

Core table. Every match in the tournament.

```sql
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  court_id uuid references courts(id),
  player1_id uuid references players(id),
  player2_id uuid references players(id),
  draw text,
  round text,                    -- "R32", "QF", "SF", "F", "RR Pool A"
  match_number int,
  status text default 'scheduled'
    check (status in ('scheduled', 'on_deck', 'in_progress', 'completed', 'walkover', 'cancelled')),
  scheduled_time timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  scores jsonb default '[]'::jsonb,  -- [{p1: 11, p2: 7}, ...]
  winner_id uuid references players(id),
  notes text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**Match status flow:** `scheduled → on_deck → in_progress → completed`

---

## announcements

Organizer-pushed messages. Normal or urgent priority.

```sql
create table announcements (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  message text not null,
  priority text default 'normal' check (priority in ('normal', 'urgent')),
  created_by uuid,
  created_at timestamptz default now()
);
```

---

## volunteers

Public signups. Each volunteer gets a Supabase Auth account.

```sql
create table volunteers (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  availability text,
  skills text,
  notes text,
  user_id uuid,                  -- Supabase Auth user ID (created on signup)
  created_at timestamptz default now()
);
```

**Note:** Volunteers are automatically added to `email_recipients` with `type = 'volunteer'`.

---

## email_recipients

Per-tournament marketing/contact list.

```sql
create table email_recipients (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  name text not null,
  email text not null,
  type text default 'invitee'    -- 'player' | 'volunteer' | 'invitee' | 'other'
    check (type in ('player', 'volunteer', 'invitee', 'other')),
  subscribed boolean default true,
  created_at timestamptz default now(),
  unique(tournament_id, email)
);
```

---

## email_campaigns

Sent email campaigns per tournament.

```sql
create table email_campaigns (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  subject text not null,
  body text not null,
  status text default 'draft'    -- 'draft' | 'sending' | 'sent' | 'failed'
    check (status in ('draft', 'sending', 'sent', 'failed')),
  sent_at timestamptz,
  sent_count int default 0,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

---

## email_sends

Per-recipient send records for each campaign.

```sql
create table email_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references email_campaigns(id) on delete cascade,
  recipient_id uuid references email_recipients(id),
  status text default 'pending'  -- 'pending' | 'sent' | 'failed'
    check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz default now()
);
```

---

## push_subscriptions

Browser push notification subscriptions (VAPID).

```sql
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);
```

---

## site_settings

Key/value store for global site configuration (homepage content).

```sql
create table site_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
```

**Current keys:**

| Key | Default | Purpose |
|-----|---------|---------|
| `homepage_hero_image` | null | Full-width background photo URL |
| `homepage_hero_gradient` | `'navy'` | Gradient preset key |
| `homepage_hero_text_color` | `'white'` | Text color preset key |
| `homepage_hero_overlay` | `'true'` | Dark tint over image |
| `homepage_hero_title` | (set) | Main headline |
| `homepage_hero_subtitle` | (set) | Subheading |
| `homepage_cta1_label` | `'View Tournaments'` | Button 1 text |
| `homepage_cta1_href` | `'#tournaments'` | Button 1 link |
| `homepage_cta2_label` | `'Donate'` | Button 2 text |
| `homepage_cta2_href` | `'/donate'` | Button 2 link |

---

## Realtime

Enable on these tables in Supabase Dashboard → Database → Replication:
- `matches` — court assignments, status, scores
- `announcements` — new messages push to all clients
- `courts` — status changes

---

## Indexes

```sql
create index idx_matches_tournament on matches(tournament_id);
create index idx_matches_status on matches(tournament_id, status);
create index idx_matches_court on matches(court_id);
create index idx_matches_player1 on matches(player1_id);
create index idx_matches_player2 on matches(player2_id);
create index idx_players_tournament on players(tournament_id);
create index idx_announcements_tournament on announcements(tournament_id, created_at desc);
create index idx_email_recipients_tournament on email_recipients(tournament_id);
```

---

## RLS (Row Level Security)

Public read on all tables. Writes require authenticated Supabase Auth user.

```sql
-- Pattern for each table:
alter table tournaments enable row level security;
create policy "Public read" on tournaments for select using (true);
create policy "Auth write" on tournaments for all
  using (auth.role() = 'authenticated');
```

---

## Migration Files

| File | Contents |
|------|---------|
| `supabase/tournament-details-migration.sql` | Adds detail/contact/schedule/info columns to tournaments |
| `supabase/site-settings-migration.sql` | Creates site_settings table with default seed data |
| `supabase/tournament-hero-migration.sql` | Adds hero_gradient, hero_text_color to tournaments |
| `supabase/hero-overlay-migration.sql` | Adds hero_overlay to tournaments, hero_overlay to site_settings |
| `supabase/tournament-hero-bg-migration.sql` | Adds hero_image_url to tournaments |

create table if not exists site_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);

-- Seed default homepage values (only if not already set)
insert into site_settings (key, value) values
  ('homepage_hero_image', null),
  ('homepage_hero_title', 'Unleash your inner athlete and play the ultimate game.'),
  ('homepage_hero_subtitle', 'Your home for competitive squash in the Pacific Northwest. Over 70 years of fostering the squash community in Seattle.'),
  ('homepage_cta1_label', 'View Tournaments'),
  ('homepage_cta1_href', '#tournaments'),
  ('homepage_cta2_label', 'Donate'),
  ('homepage_cta2_href', '/donate')
on conflict (key) do nothing;

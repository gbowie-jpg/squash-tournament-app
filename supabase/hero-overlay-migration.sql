-- 'true' = apply dark overlay over image (default), 'false' = show image as-is
alter table tournaments add column if not exists hero_overlay text default 'true';
insert into site_settings (key, value) values ('homepage_hero_overlay', 'true') on conflict (key) do nothing;

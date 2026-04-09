alter table tournaments
  add column if not exists hero_gradient text,
  add column if not exists hero_text_color text;

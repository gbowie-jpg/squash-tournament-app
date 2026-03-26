-- Profiles table for global user roles
-- Run this in Supabase SQL Editor
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'user' check (role in ('user', 'admin', 'superadmin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table profiles enable row level security;

-- Everyone can read profiles (needed for organizer lookups)
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

-- Users can update their own profile (name only)
create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Superadmins can update any profile
create policy "Superadmins can update any profile"
  on profiles for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'superadmin'
    )
  );

-- Allow insert for new users (triggered by auth signup)
create policy "Users can insert own profile"
  on profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set the first user (you) as superadmin
-- Replace with your actual user ID after signup, or run:
-- update profiles set role = 'superadmin' where email = 'your@email.com';

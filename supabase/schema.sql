-- Enable the Realtime extension
drop publication if exists supabase_realtime;
create publication supabase_realtime;

-- Create rooms table
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null check (status in ('LOBBY', 'INSTRUCTIONS', 'PLAYING', 'SCOREBOARD')),
  current_game_id text,
  created_at timestamp with time zone default now()
);

-- Create players table
create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  username text not null,
  avatar_id int default 0,
  score int default 0,
  is_host boolean default false,
  last_seen timestamp with time zone default now()
);

-- Enable Realtime for specific tables
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table players;

-- Row Level Security (RLS)
-- For this party game, we want to allow public access for simplicity, 
-- but in a production app you'd want stricter policies.
-- We will enable RLS but add policies to allow public access for now as per "Auth Anonymously" requirement.

alter table rooms enable row level security;
alter table players enable row level security;

-- Policies for rooms
create policy "Public rooms access"
  on rooms for all
  using (true)
  with check (true);

-- Policies for players
create policy "Public players access"
  on players for all
  using (true)
  with check (true);

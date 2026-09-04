-- Steg 2: flera användare. Tokens lagras krypterade (lib/crypto.ts), aldrig i klartext.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  university text,              -- t.ex. 'kth'
  canvas_base_url text,         -- t.ex. 'https://canvas.kth.se'
  canvas_token_enc text,        -- AES-256-GCM-blob
  timeedit_ical_url text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "own profile" on profiles for all using (auth.uid() = id);

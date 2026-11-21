-- Nexora AI 6.3: ejecutar en Supabase SQL Editor, una sola vez.
create extension if not exists btree_gist;
create table if not exists public.nexora_businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null default 'Mi negocio' check (char_length(name) between 1 and 100),
 type text not null default 'general',
 created_at timestamptz not null default now(),
 unique (owner_id)
);
create table if not exists public.nexora_clients (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.nexora_businesses(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 phone text not null default '', email text not null default '',
 created_at timestamptz not null default now(),
 unique (id,business_id)
);
create table if not exists public.nexora_bookings (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.nexora_businesses(id) on delete cascade,
 client_id uuid not null,
 service text not null check (char_length(service) between 1 and 100),
 start_at timestamptz not null,
 duration_minutes integer not null check (duration_minutes between 15 and 480),
 resource text not null default 'Principal' check (char_length(resource) between 1 and 80),
 end_at timestamptz generated always as (start_at + duration_minutes * interval '1 minute') stored,
 created_at timestamptz not null default now(),
 foreign key (client_id,business_id) references public.nexora_clients(id,business_id) on delete restrict,
 constraint nexora_booking_no_overlap exclude using gist (
  business_id with =,
  resource with =,
  tstzrange(start_at, start_at + duration_minutes * interval '1 minute', '[)') with &&
 )
);
create index if not exists nexora_clients_business_idx on public.nexora_clients(business_id);
create index if not exists nexora_bookings_business_idx on public.nexora_bookings(business_id,start_at);
alter table public.nexora_businesses enable row level security;
alter table public.nexora_clients enable row level security;
alter table public.nexora_bookings enable row level security;
-- El propietario autenticado puede operar exclusivamente sobre su negocio.
create policy "nexora_business_owner" on public.nexora_businesses for all to authenticated
 using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "nexora_clients_owner" on public.nexora_clients for all to authenticated
 using (exists (select 1 from public.nexora_businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check (exists (select 1 from public.nexora_businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "nexora_bookings_owner" on public.nexora_bookings for all to authenticated
 using (exists (select 1 from public.nexora_businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check (exists (select 1 from public.nexora_businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
revoke all on public.nexora_businesses, public.nexora_clients, public.nexora_bookings from anon;
grant select,insert,update,delete on public.nexora_businesses, public.nexora_clients, public.nexora_bookings to authenticated;

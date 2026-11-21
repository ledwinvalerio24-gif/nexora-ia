-- Ejecuta en Supabase > SQL Editor, una sola vez. Seguro de volver a ejecutar.
create extension if not exists pgcrypto;
create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Nueva conversación' check (char_length(title)<=100),
 created_at timestamptz not null default now()
);
create index if not exists conversations_user_created_idx on public.conversations(user_id,created_at desc);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('user','assistant')),
 content text not null check (char_length(content) between 1 and 12000),
 created_at timestamptz not null default now()
);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id,created_at);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
drop policy if exists "Own conversations select" on public.conversations;
drop policy if exists "Own conversations insert" on public.conversations;
drop policy if exists "Own conversations update" on public.conversations;
drop policy if exists "Own conversations delete" on public.conversations;
create policy "Own conversations select" on public.conversations for select to authenticated using (user_id=(select auth.uid()));
create policy "Own conversations insert" on public.conversations for insert to authenticated with check (user_id=(select auth.uid()));
create policy "Own conversations update" on public.conversations for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy "Own conversations delete" on public.conversations for delete to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Own messages select" on public.messages;
drop policy if exists "Own messages insert" on public.messages;
create policy "Own messages select" on public.messages for select to authenticated using (user_id=(select auth.uid()) and exists (select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));
create policy "Own messages insert" on public.messages for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from public.conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));
-- No update/delete of individual messages: delete the parent conversation instead.
create table if not exists public.ai_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 total integer not null default 0,
 last_minute timestamptz not null default date_trunc('minute',now()),
 minute_total integer not null default 0,
 primary key(user_id,usage_day)
);
alter table public.ai_usage enable row level security;
-- No direct user access to usage counters.
revoke all on public.ai_usage from anon,authenticated;
create or replace function public.consume_ai_quota() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); n integer; t timestamptz := date_trunc('minute',now());
begin
 if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
 insert into public.ai_usage(user_id,usage_day,total,last_minute,minute_total)
 values(uid,(now() at time zone 'UTC')::date,0,t,0) on conflict do nothing;
 update public.ai_usage set
  total=total+1,
  minute_total=case when last_minute=t then minute_total+1 else 1 end,
  last_minute=t
 where user_id=uid and usage_day=(now() at time zone 'UTC')::date
   and total<30 and (last_minute<>t or minute_total<5);
 get diagnostics n = row_count;
 if n<>1 then raise exception 'Usage limit reached' using errcode='P0001'; end if;
end $$;
revoke all on function public.consume_ai_quota() from public,anon;
grant execute on function public.consume_ai_quota() to authenticated;
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.conversations to authenticated;
grant select,insert on public.messages to authenticated;

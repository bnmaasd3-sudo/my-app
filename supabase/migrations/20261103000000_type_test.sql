-- The type test (/[lang]/test). The test keeps documents the way its own page
-- did; each one is a row here:
--   * a reader's own attempt: key = their account id, user_id = them;
--   * the owner's trial runs, pasted result codes and archived attempts:
--     keys trial_*, code_* and <account id>__old_*.
-- Readers write and read their own attempt only; the owner reads everything
-- and may write any row (trials, reopening an attempt). Rows are never deleted.

create table public.test_results (
  key text primary key check (char_length(key) between 1 and 200),
  user_id uuid references auth.users (id),
  -- The whole attempt as the test keeps it (answers, cards, follow-ups, timing).
  answers jsonb not null,
  -- A short summary for lists: the result code, status, path and name.
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_results_size check (pg_column_size(answers) < 2000000)
);

create index test_results_user_id on public.test_results (user_id);

alter table public.test_results enable row level security;

revoke all on public.test_results from anon;
revoke all on public.test_results from authenticated;
grant select, insert, update on public.test_results to authenticated;

create policy "readers read their own test, the owner reads all"
  on public.test_results for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "readers save their own test, the owner saves any"
  on public.test_results for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and key = (select auth.uid())::text)
    or (select public.is_admin())
  );

create policy "readers update their own test, the owner updates any"
  on public.test_results for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()))
  with check (
    (user_id = (select auth.uid()) and key = (select auth.uid())::text)
    or (select public.is_admin())
  );

-- A reader cannot move their row to another key or account, or back-date it.
create function public.test_results_stamp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin() then
    new.key := old.key;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  elsif tg_op = 'INSERT' and not public.is_admin() then
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.test_results_stamp() from public, anon, authenticated;

create trigger test_results_stamp
  before insert or update on public.test_results
  for each row execute function public.test_results_stamp();

-- The path new attempts take (classic, branch or typed), chosen by the owner.
create table public.test_settings (
  id boolean primary key default true check (id),
  path text not null check (path in ('classic', 'branch', 'typed')),
  updated_at timestamptz not null default now()
);

alter table public.test_settings enable row level security;

revoke all on public.test_settings from anon;
revoke all on public.test_settings from authenticated;
grant select, insert, update on public.test_settings to authenticated;

create policy "signed-in readers read the test path"
  on public.test_settings for select to authenticated
  using (true);

create policy "the owner sets the test path"
  on public.test_settings for insert to authenticated
  with check ((select public.is_admin()));

create policy "the owner changes the test path"
  on public.test_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

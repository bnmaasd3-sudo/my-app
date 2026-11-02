-- Invitations: only emails the owner (or a Salla purchase) invited can get a
-- sign-in account, so the app can create accounts on first sign-in without a
-- service key and nobody else can sign up. Also lets readers fetch the book's
-- figures from the private "figures" bucket, and only for books they own.

create table public.invites (
  email text primary key check (email = lower(email) and email <> ''),
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Books waiting for an invited email that has not signed in yet.
create table public.pending_entitlements (
  email text not null references public.invites (email),
  book_id uuid not null references public.books (id),
  source text not null default 'manual' check (source in ('manual', 'salla')),
  order_id text,
  created_at timestamptz not null default now(),
  primary key (email, book_id)
);

create index pending_entitlements_book_id_idx on public.pending_entitlements (book_id);

alter table public.invites enable row level security;
alter table public.pending_entitlements enable row level security;
revoke all on public.invites, public.pending_entitlements from anon, authenticated;

-- Turns an invite into an owner and/or a reader with their books.
create function public.apply_invite(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.invites;
begin
  select * into v_invite from public.invites i where i.email = lower(p_email);
  if not found then
    return;
  end if;

  if v_invite.is_admin then
    insert into public.admins (user_id) values (p_user_id) on conflict do nothing;
  end if;

  if not v_invite.is_admin or exists (select 1 from public.pending_entitlements p where p.email = v_invite.email) then
    insert into public.readers (id, email, display_name, active)
    values (p_user_id, v_invite.email, v_invite.display_name, true)
    on conflict (id) do nothing;
  end if;

  insert into public.entitlements (reader_id, book_id, active, source)
  select p_user_id, p.book_id, true, p.source
  from public.pending_entitlements p
  where p.email = v_invite.email
  on conflict (reader_id, book_id) do update
  set active = true,
      updated_at = now();

  insert into public.salla_orders (order_id, reader_id, book_id)
  select p.order_id, p_user_id, p.book_id
  from public.pending_entitlements p
  where p.email = v_invite.email and p.order_id is not null
  on conflict do nothing;

  delete from public.pending_entitlements p where p.email = v_invite.email;
end;
$$;

-- Before an account is created: refuse emails nobody invited, and drop any
-- password, since readers sign in with emailed codes only. This also stops
-- someone from signing up with a buyer's email and a password ahead of them.
create function public.guard_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.invites i where i.email = lower(new.email)) then
    raise exception 'signup_not_allowed' using errcode = '42501';
  end if;
  new.encrypted_password := '';
  return new;
end;
$$;

create function public.activate_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_invite(new.id, new.email);
  return new;
end;
$$;

revoke execute on function public.apply_invite(uuid, text) from public, anon, authenticated;
revoke execute on function public.guard_new_user() from public, anon, authenticated;
revoke execute on function public.activate_new_user() from public, anon, authenticated;

create trigger qari_guard_new_user
before insert on auth.users
for each row execute function public.guard_new_user();

create trigger qari_activate_new_user
after insert on auth.users
for each row execute function public.activate_new_user();

-- Owner panel: add a reader by email and give them a book. If they already
-- have an account the book opens now; otherwise on their first sign-in.
create function public.admin_add_reader(p_email text, p_display_name text, p_book_slug text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_book_id uuid;
  v_user_id uuid;
begin
  perform public.assert_admin();

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  select b.id into v_book_id from public.books b where b.slug = p_book_slug;
  if not found then
    raise exception 'book_not_found' using errcode = 'P0002';
  end if;

  insert into public.invites (email, display_name)
  values (v_email, nullif(trim(p_display_name), ''))
  on conflict (email) do update
  set display_name = coalesce(excluded.display_name, public.invites.display_name);

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email;
  if v_user_id is null then
    insert into public.pending_entitlements (email, book_id, source)
    values (v_email, v_book_id, 'manual')
    on conflict (email, book_id) do nothing;
    return 'invited';
  end if;

  insert into public.readers (id, email, display_name, active)
  values (v_user_id, v_email, nullif(trim(p_display_name), ''), true)
  on conflict (id) do update
  set active = true,
      display_name = coalesce(nullif(trim(excluded.display_name), ''), public.readers.display_name);

  insert into public.entitlements (reader_id, book_id, active, source)
  values (v_user_id, v_book_id, true, 'manual')
  on conflict (reader_id, book_id) do update
  set active = true,
      updated_at = now();
  return 'linked';
end;
$$;

revoke execute on function public.admin_add_reader(text, text, text) from public, anon;
grant execute on function public.admin_add_reader(text, text, text) to authenticated;

-- Superseded by admin_add_reader (accounts are no longer created by the server).
drop function public.admin_register_reader(uuid, text, text);

-- Salla by email: unlock now if the buyer has an account, otherwise invite
-- them and unlock on their first sign-in.
create function public.salla_grant_email(p_order_id text, p_email text, p_name text, p_skus text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_user_id uuid;
begin
  insert into public.invites (email, display_name)
  values (v_email, nullif(trim(p_name), ''))
  on conflict (email) do nothing;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email;
  if v_user_id is not null then
    return public.salla_grant_order(p_order_id, v_user_id, v_email, p_name, p_skus)
      || jsonb_build_object('pending', false);
  end if;

  insert into public.pending_entitlements (email, book_id, source, order_id)
  select v_email, p.book_id, 'salla', p_order_id
  from public.salla_products p
  where p.sku = any (p_skus)
  on conflict (email, book_id) do update
  set source = 'salla',
      order_id = excluded.order_id;

  return jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(distinct b.slug)
      from public.salla_products p join public.books b on b.id = p.book_id
      where p.sku = any (p_skus)
    ), '[]'::jsonb),
    'unknown_skus', coalesce((
      select jsonb_agg(s) from unnest(p_skus) s
      where not exists (select 1 from public.salla_products p where p.sku = s)
    ), '[]'::jsonb),
    'pending', true
  );
end;
$$;

revoke execute on function public.salla_grant_email(text, text, text, text[]) from public, anon, authenticated;
grant execute on function public.salla_grant_email(text, text, text, text[]) to service_role;

-- A refund also cancels a book still waiting for the buyer's first sign-in.
create or replace function public.salla_revoke_order(p_order_id text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_pending int;
begin
  update public.entitlements e
  set active = false,
      updated_at = now()
  from public.salla_orders o
  where o.order_id = p_order_id
    and e.reader_id = o.reader_id
    and e.book_id = o.book_id
    and e.source = 'salla'
    and e.active;
  get diagnostics v_count = row_count;

  delete from public.pending_entitlements p where p.order_id = p_order_id;
  get diagnostics v_pending = row_count;
  return v_count + v_pending;
end;
$$;

-- Figures: private bucket "figures", paths "<book slug>/figures/<file>".
create function public.can_read_book_files(p_book_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.books b
    join public.entitlements e on e.book_id = b.id
    join public.readers r on r.id = e.reader_id
    where b.slug = p_book_slug
      and e.reader_id = (select auth.uid())
      and e.active
      and r.active
  );
$$;

revoke execute on function public.can_read_book_files(text) from public, anon;
grant execute on function public.can_read_book_files(text) to authenticated;

create policy "readers read figures of books they own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'figures'
  and public.can_read_book_files((storage.foldername(name))[1])
);

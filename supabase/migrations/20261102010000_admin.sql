-- Owner panel: only accounts listed in public.admins may manage readers,
-- link them to books, suspend them or remove their devices. Every action goes
-- through a SECURITY DEFINER function that checks the caller first.

create table public.admins (
  user_id uuid primary key references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

create function public.assert_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.assert_admin() from public, anon, authenticated;

-- Everything the panel shows, in one call.
create function public.admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return jsonb_build_object(
    'books', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', b.slug,
        'title', b.title,
        'lang', b.lang,
        'chapters', (select count(*) from public.chapters c where c.book_id = b.id),
        'readers', (select count(*) from public.entitlements e where e.book_id = b.id and e.active)
      ) order by b.title)
      from public.books b
    ), '[]'::jsonb),
    'readers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'email', r.email,
        'name', r.display_name,
        'active', r.active,
        'created_at', r.created_at,
        'books', coalesce((
          select jsonb_agg(jsonb_build_object(
            'slug', b.slug, 'title', b.title, 'active', e.active, 'source', e.source
          ) order by b.title)
          from public.entitlements e join public.books b on b.id = e.book_id
          where e.reader_id = r.id
        ), '[]'::jsonb),
        'devices', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', d.device_id, 'last_seen', d.last_seen, 'revoked', d.revoked
          ) order by d.last_seen desc)
          from public.devices d where d.reader_id = r.id
        ), '[]'::jsonb),
        'last_read_at', (select max(l.opened_at) from public.reading_log l where l.reader_id = r.id)
      ) order by r.created_at desc)
      from public.readers r
    ), '[]'::jsonb),
    'reads', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.opened_at desc)
      from (
        select r.email, b.title as book, c.title as chapter, l.opened_at
        from public.reading_log l
        join public.readers r on r.id = l.reader_id
        join public.chapters c on c.id = l.chapter_id
        join public.books b on b.id = c.book_id
        order by l.opened_at desc
        limit 30
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- Creates the reader row for an existing sign-in account, or re-activates it.
-- The email must be the account's own, so an id cannot be paired with
-- someone else's address.
create function public.admin_register_reader(p_user_id uuid, p_email text, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  if not exists (
    select 1 from auth.users u where u.id = p_user_id and lower(u.email) = lower(p_email)
  ) then
    raise exception 'account_mismatch' using errcode = '22023';
  end if;

  insert into public.readers (id, email, display_name, active)
  values (p_user_id, lower(p_email), nullif(trim(p_display_name), ''), true)
  on conflict (id) do update
  set active = true,
      display_name = coalesce(nullif(trim(excluded.display_name), ''), public.readers.display_name);
end;
$$;

create function public.admin_set_reader_active(p_reader_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.readers set active = p_active where id = p_reader_id;
  if not found then
    raise exception 'reader_not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Links a reader to a book (or unlinks it). Nothing is ever deleted; an
-- existing link keeps its original source.
create function public.admin_set_entitlement(p_reader_id uuid, p_book_slug text, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book_id uuid;
begin
  perform public.assert_admin();

  select b.id into v_book_id from public.books b where b.slug = p_book_slug;
  if not found then
    raise exception 'book_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.readers r where r.id = p_reader_id) then
    raise exception 'reader_not_found' using errcode = 'P0002';
  end if;

  insert into public.entitlements (reader_id, book_id, active, source)
  values (p_reader_id, v_book_id, p_active, 'manual')
  on conflict (reader_id, book_id) do update
  set active = excluded.active,
      updated_at = now();
end;
$$;

create function public.admin_revoke_device(p_reader_id uuid, p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();
  update public.devices
  set revoked = true
  where reader_id = p_reader_id and device_id = p_device_id;
end;
$$;

revoke execute on function public.admin_dashboard() from public, anon;
revoke execute on function public.admin_register_reader(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_reader_active(uuid, boolean) from public, anon;
revoke execute on function public.admin_set_entitlement(uuid, text, boolean) from public, anon;
revoke execute on function public.admin_revoke_device(uuid, text) from public, anon;

grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_register_reader(uuid, text, text) to authenticated;
grant execute on function public.admin_set_reader_active(uuid, boolean) to authenticated;
grant execute on function public.admin_set_entitlement(uuid, text, boolean) to authenticated;
grant execute on function public.admin_revoke_device(uuid, text) to authenticated;

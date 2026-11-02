-- Qari phase 1: books, chapters, readers and the rules for who may read what.
--
-- Book text is never readable through a table policy. Readers get a chapter
-- only through public.open_chapter(), which checks the account, the
-- entitlement and the two-device limit, and logs every read.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  lang text not null default 'ar' check (lang in ('ar', 'en')),
  created_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id),
  position int not null check (position > 0),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (book_id, position)
);

create table public.readers (
  id uuid primary key references auth.users (id),
  email text not null unique,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.entitlements (
  reader_id uuid not null references public.readers (id),
  book_id uuid not null references public.books (id),
  active boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'salla')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reader_id, book_id)
);

create index entitlements_book_id_idx on public.entitlements (book_id);

create table public.devices (
  reader_id uuid not null references public.readers (id),
  device_id text not null check (char_length(device_id) between 16 and 128),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  revoked boolean not null default false,
  primary key (reader_id, device_id)
);

create table public.reading_log (
  id bigint generated always as identity primary key,
  reader_id uuid not null references public.readers (id),
  chapter_id uuid not null references public.chapters (id),
  device_id text not null,
  opened_at timestamptz not null default now()
);

create index reading_log_reader_id_idx on public.reading_log (reader_id);
create index reading_log_chapter_id_idx on public.reading_log (chapter_id);

create table public.reading_state (
  reader_id uuid not null references public.readers (id),
  book_id uuid not null references public.books (id),
  chapter_id uuid references public.chapters (id),
  scroll_ratio real not null default 0 check (scroll_ratio between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (reader_id, book_id)
);

create index reading_state_book_id_idx on public.reading_state (book_id);
create index reading_state_chapter_id_idx on public.reading_state (chapter_id);

create table public.reader_prefs (
  reader_id uuid primary key references public.readers (id),
  font_size text not null default 'md' check (font_size in ('sm', 'md', 'lg')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security: on for every table. Only the rows below are reachable
-- directly; everything else goes through the functions further down.
-- ---------------------------------------------------------------------------

alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.readers enable row level security;
alter table public.entitlements enable row level security;
alter table public.devices enable row level security;
alter table public.reading_log enable row level security;
alter table public.reading_state enable row level security;
alter table public.reader_prefs enable row level security;

-- Defence in depth: no direct access to book text or the read log at all.
revoke all on public.chapters from anon, authenticated;
revoke all on public.reading_log from anon, authenticated;

create policy "readers see their own account"
on public.readers for select
to authenticated
using (id = (select auth.uid()));

create policy "readers see their own entitlements"
on public.entitlements for select
to authenticated
using (reader_id = (select auth.uid()));

create policy "readers see their own devices"
on public.devices for select
to authenticated
using (reader_id = (select auth.uid()));

create policy "readers see their own preferences"
on public.reader_prefs for select
to authenticated
using (reader_id = (select auth.uid()));

create policy "readers save their own preferences"
on public.reader_prefs for insert
to authenticated
with check (reader_id = (select auth.uid()));

create policy "readers update their own preferences"
on public.reader_prefs for update
to authenticated
using (reader_id = (select auth.uid()))
with check (reader_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- Returns the signed-in, active reader and locks their row so concurrent
-- device registrations are serialised.
create function public.current_reader_for_update()
returns public.readers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reader public.readers;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_reader
  from public.readers r
  where r.id = (select auth.uid())
  for update;

  if not found or not v_reader.active then
    raise exception 'reader_inactive' using errcode = '42501';
  end if;

  return v_reader;
end;
$$;

-- Returns the book if the reader holds an active entitlement to it. A missing
-- book and a book the reader does not own raise the same error.
create function public.entitled_book(p_reader_id uuid, p_book_slug text)
returns public.books
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book public.books;
begin
  select b.* into v_book
  from public.books b
  join public.entitlements e on e.book_id = b.id
  where b.slug = p_book_slug
    and e.reader_id = p_reader_id
    and e.active;

  if not found then
    raise exception 'not_entitled' using errcode = '42501';
  end if;

  return v_book;
end;
$$;

-- Registers the device on first use and enforces the two-device limit.
create function public.claim_device(p_reader_id uuid, p_device_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked boolean;
begin
  if p_device_id is null or char_length(p_device_id) not between 16 and 128 then
    raise exception 'device_invalid' using errcode = '22023';
  end if;

  select d.revoked into v_revoked
  from public.devices d
  where d.reader_id = p_reader_id and d.device_id = p_device_id;

  if found then
    if v_revoked then
      raise exception 'device_revoked' using errcode = '42501';
    end if;
    update public.devices d
    set last_seen = now()
    where d.reader_id = p_reader_id and d.device_id = p_device_id;
    return;
  end if;

  if (
    select count(*) from public.devices d
    where d.reader_id = p_reader_id and not d.revoked
  ) >= 2 then
    raise exception 'device_limit' using errcode = '42501';
  end if;

  insert into public.devices (reader_id, device_id)
  values (p_reader_id, p_device_id);
end;
$$;

revoke execute on function public.current_reader_for_update() from public, anon, authenticated;
revoke execute on function public.entitled_book(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_device(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client API (signed-in readers only)
-- ---------------------------------------------------------------------------

-- The books this reader may open, with where they stopped.
create function public.my_library()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reader public.readers;
begin
  v_reader := public.current_reader_for_update();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'slug', b.slug,
        'title', b.title,
        'lang', b.lang,
        'chapters', (select count(*) from public.chapters c where c.book_id = b.id),
        'position', (
          select c.position
          from public.reading_state s
          join public.chapters c on c.id = s.chapter_id
          where s.reader_id = v_reader.id and s.book_id = b.id
        )
      )
      order by b.title
    )
    from public.books b
    join public.entitlements e on e.book_id = b.id
    where e.reader_id = v_reader.id and e.active
  ), '[]'::jsonb);
end;
$$;

-- Table of contents (titles only, never chapter text).
create function public.book_toc(p_book_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reader public.readers;
  v_book public.books;
begin
  v_reader := public.current_reader_for_update();
  v_book := public.entitled_book(v_reader.id, p_book_slug);

  return jsonb_build_object(
    'book', jsonb_build_object('slug', v_book.slug, 'title', v_book.title, 'lang', v_book.lang),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object('position', c.position, 'title', c.title) order by c.position)
      from public.chapters c
      where c.book_id = v_book.id
    ), '[]'::jsonb),
    'position', (
      select c.position
      from public.reading_state s
      join public.chapters c on c.id = s.chapter_id
      where s.reader_id = v_reader.id and s.book_id = v_book.id
    )
  );
end;
$$;

-- One chapter for reading. Checks account, entitlement and device, logs the
-- read, records it as the current chapter, and returns the reader's name and
-- email for the watermark.
create function public.open_chapter(p_book_slug text, p_position int, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reader public.readers;
  v_book public.books;
  v_chapter public.chapters;
  v_ratio real := 0;
  v_total int;
begin
  v_reader := public.current_reader_for_update();
  v_book := public.entitled_book(v_reader.id, p_book_slug);
  perform public.claim_device(v_reader.id, p_device_id);

  select c.* into v_chapter
  from public.chapters c
  where c.book_id = v_book.id and c.position = p_position;

  if not found then
    raise exception 'chapter_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_total from public.chapters c where c.book_id = v_book.id;

  insert into public.reading_log (reader_id, chapter_id, device_id)
  values (v_reader.id, v_chapter.id, p_device_id);

  select s.scroll_ratio into v_ratio
  from public.reading_state s
  where s.reader_id = v_reader.id
    and s.book_id = v_book.id
    and s.chapter_id = v_chapter.id;

  insert into public.reading_state (reader_id, book_id, chapter_id, scroll_ratio)
  values (v_reader.id, v_book.id, v_chapter.id, coalesce(v_ratio, 0))
  on conflict (reader_id, book_id) do update
  set chapter_id = excluded.chapter_id,
      scroll_ratio = excluded.scroll_ratio,
      updated_at = now();

  return jsonb_build_object(
    'book', jsonb_build_object('slug', v_book.slug, 'title', v_book.title, 'lang', v_book.lang),
    'chapter', jsonb_build_object(
      'position', v_chapter.position,
      'title', v_chapter.title,
      'body', v_chapter.body
    ),
    'total', v_total,
    'scroll_ratio', coalesce(v_ratio, 0),
    'reader', jsonb_build_object(
      'name', coalesce(nullif(v_reader.display_name, ''), v_reader.email),
      'email', v_reader.email
    )
  );
end;
$$;

-- Saves how far down the current chapter the reader has scrolled. Only an
-- allowed device may move the saved position.
create function public.save_progress(
  p_book_slug text,
  p_position int,
  p_scroll_ratio real,
  p_device_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reader public.readers;
  v_book public.books;
  v_chapter_id uuid;
begin
  v_reader := public.current_reader_for_update();
  v_book := public.entitled_book(v_reader.id, p_book_slug);
  perform public.claim_device(v_reader.id, p_device_id);

  select c.id into v_chapter_id
  from public.chapters c
  where c.book_id = v_book.id and c.position = p_position;

  if not found then
    raise exception 'chapter_not_found' using errcode = 'P0002';
  end if;

  insert into public.reading_state (reader_id, book_id, chapter_id, scroll_ratio)
  values (v_reader.id, v_book.id, v_chapter_id, least(greatest(coalesce(p_scroll_ratio, 0), 0), 1))
  on conflict (reader_id, book_id) do update
  set chapter_id = excluded.chapter_id,
      scroll_ratio = excluded.scroll_ratio,
      updated_at = now();
end;
$$;

revoke execute on function public.my_library() from public, anon;
revoke execute on function public.book_toc(text) from public, anon;
revoke execute on function public.open_chapter(text, int, text) from public, anon;
revoke execute on function public.save_progress(text, int, real, text) from public, anon;

grant execute on function public.my_library() to authenticated;
grant execute on function public.book_toc(text) to authenticated;
grant execute on function public.open_chapter(text, int, text) to authenticated;
grant execute on function public.save_progress(text, int, real, text) to authenticated;

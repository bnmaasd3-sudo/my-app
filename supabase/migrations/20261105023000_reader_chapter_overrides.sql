-- Per-reader customisation of a shared book: the owner can hide chapters, or
-- replace a chapter's text, for one reader without uploading the book again.
-- A hidden chapter is gone for that reader everywhere: the contents, the
-- chapter count, previous/next, and opening it by its number.
-- (A wholly different edition for one reader is still its own book slug,
-- granted to that reader only.)

create table if not exists public.reader_chapter_overrides (
  reader_id uuid not null references public.readers (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  hidden boolean not null default false,
  body_override text,
  note text check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (reader_id, chapter_id)
);

alter table public.reader_chapter_overrides enable row level security;
-- No policies on purpose: readers reach it only through book_toc, open_chapter
-- and my_library, the owner only through the admin_* functions below.
revoke all on public.reader_chapter_overrides from anon, authenticated;

-- The contents, without the chapters hidden for this reader. `position` is
-- where they stopped (null if that chapter is now hidden), `first` the first
-- chapter they can open.
create or replace function public.book_toc(p_book_slug text)
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
      where c.book_id = v_book.id and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        )
    ), '[]'::jsonb),
    'position', (
      select c.position
      from public.reading_state s
      join public.chapters c on c.id = s.chapter_id
      where s.reader_id = v_reader.id and s.book_id = v_book.id
        and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        )
    ),
    'first', (
      select min(c.position) from public.chapters c
      where c.book_id = v_book.id and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        )
    )
  );
end;
$$;

-- One chapter, with this reader's text if the owner replaced it. A hidden
-- chapter is not found. `prev`/`next` are the nearest chapters the reader can
-- open (null at the ends), `total` how many they can open, and `index` this
-- chapter's place among them.
create or replace function public.open_chapter(p_book_slug text, p_position int, p_device_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reader public.readers;
  v_book public.books;
  v_chapter public.chapters;
  v_override public.reader_chapter_overrides;
  v_ratio real := 0;
  v_total int;
  v_index int;
  v_prev int;
  v_next int;
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

  select o.* into v_override
  from public.reader_chapter_overrides o
  where o.reader_id = v_reader.id and o.chapter_id = v_chapter.id;

  if found and v_override.hidden then
    raise exception 'chapter_not_found' using errcode = 'P0002';
  end if;

  select count(*),
         count(*) filter (where c.position <= p_position),
         max(c.position) filter (where c.position < p_position),
         min(c.position) filter (where c.position > p_position)
    into v_total, v_index, v_prev, v_next
  from public.chapters c
  where c.book_id = v_book.id and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        );

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
      'body', coalesce(v_override.body_override, v_chapter.body)
    ),
    'total', v_total,
    'index', v_index,
    'prev', v_prev,
    'next', v_next,
    'scroll_ratio', coalesce(v_ratio, 0),
    'reader', jsonb_build_object(
      'name', coalesce(nullif(v_reader.display_name, ''), v_reader.email),
      'email', v_reader.email
    )
  );
end;
$$;

-- Saving the place in a hidden chapter is refused like opening it.
create or replace function public.save_progress(
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

  if not found or exists (
    select 1 from public.reader_chapter_overrides o
    where o.reader_id = v_reader.id and o.chapter_id = v_chapter_id and o.hidden
  ) then
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

-- The library counts only the chapters this reader can open, and starts them
-- at the first of those.
create or replace function public.my_library()
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
        'type_code', b.type_code,
        'kind', b.kind,
        'chapters', (
          select count(*) from public.chapters c
          where c.book_id = b.id and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        )
        ),
        'position', (
          select c.position
          from public.reading_state s
          join public.chapters c on c.id = s.chapter_id
          where s.reader_id = v_reader.id and s.book_id = b.id
            and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        )
        ),
        'first', (
          select min(c.position) from public.chapters c
          where c.book_id = b.id and not exists (
          select 1 from public.reader_chapter_overrides o
          where o.reader_id = v_reader.id and o.chapter_id = c.id and o.hidden
        )
        )
      )
      order by b.type_code nulls last,
        case b.kind when 'encyclopedia' then 1 when 'novel' then 2 else 3 end,
        b.title
    )
    from public.books b
    join public.entitlements e on e.book_id = b.id
    where e.reader_id = v_reader.id and e.active
  ), '[]'::jsonb);
end;
$$;

-- The owner panel: as before, and each reader's book also says how many of
-- its chapters are hidden for them.
create or replace function public.admin_dashboard()
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
            'slug', b.slug, 'title', b.title, 'active', e.active, 'source', e.source,
            'hidden', (
              select count(*) from public.reader_chapter_overrides o
              join public.chapters c on c.id = o.chapter_id
              where o.reader_id = r.id and c.book_id = b.id and o.hidden
            ),
            'replaced', (
              select count(*) from public.reader_chapter_overrides o
              join public.chapters c on c.id = o.chapter_id
              where o.reader_id = r.id and c.book_id = b.id and o.body_override is not null
            )
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
        'last_read_at', (select max(l.opened_at) from public.reading_log l where l.reader_id = r.id),
        'last_sign_in_at', (select u.last_sign_in_at from auth.users u where u.id = r.id)
      ) order by r.created_at desc)
      from public.readers r
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', i.email,
        'name', i.display_name,
        'created_at', i.created_at,
        'books', coalesce((
          select jsonb_agg(b.title order by b.title)
          from public.pending_entitlements p join public.books b on b.id = p.book_id
          where p.email = i.email
        ), '[]'::jsonb)
      ) order by i.created_at desc)
      from public.invites i
      -- Not used = nobody has signed in with that email yet (the owner's own
      -- invite makes no reader row, so readers is not the right test).
      where not exists (select 1 from auth.users u where lower(u.email) = i.email)
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

-- Owner: a book's chapters for one reader, with what is hidden or replaced.
create function public.admin_reader_chapters(p_reader_id uuid, p_book_slug text)
returns jsonb
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'position', c.position,
      'title', c.title,
      'hidden', coalesce(o.hidden, false),
      'body_override', o.body_override,
      'note', o.note
    ) order by c.position)
    from public.chapters c
    left join public.reader_chapter_overrides o
      on o.chapter_id = c.id and o.reader_id = p_reader_id
    where c.book_id = v_book_id
  ), '[]'::jsonb);
end;
$$;

-- Owner: hide or show a chapter for one reader, and replace its text (empty =
-- the shared text). Nothing is deleted: going back to the shared chapter
-- keeps the row with nothing set. The book's first chapter carries the
-- support line, so it is never hidden, its own text must still open with that
-- line, and no other chapter's text may carry it (CLAUDE.md).
create function public.admin_set_chapter_override(
  p_reader_id uuid,
  p_book_slug text,
  p_position int,
  p_hidden boolean,
  p_body_override text default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_support constant text := 'الدعم في السعودية: 937 (وزارة الصحة) | الطوارئ: 911 | الهلال الأحمر: 997';
  v_chapter_id uuid;
  v_first boolean;
  v_body text := case when btrim(coalesce(p_body_override, '')) = '' then null else p_body_override end;
begin
  perform public.assert_admin();

  select c.id, c.position = (select min(f.position) from public.chapters f where f.book_id = c.book_id)
    into v_chapter_id, v_first
  from public.chapters c
  join public.books b on b.id = c.book_id
  where b.slug = p_book_slug and c.position = p_position;

  if not found then
    raise exception 'chapter_not_found' using errcode = 'P0002';
  end if;

  if v_first and coalesce(p_hidden, false) then
    raise exception 'first_chapter_stays' using errcode = '22023';
  end if;

  if v_body is not null then
    if v_first and (
      select btrim(l) from unnest(string_to_array(v_body, E'\n')) with ordinality as t(l, n)
      where btrim(l) <> '' order by n limit 1
    ) is distinct from v_support then
      raise exception 'support_line' using errcode = '22023';
    end if;
    if (char_length(v_body) - char_length(replace(v_body, v_support, ''))) / char_length(v_support)
      > (case when v_first then 1 else 0 end) then
      raise exception 'support_line' using errcode = '22023';
    end if;
  end if;

  if not exists (select 1 from public.readers r where r.id = p_reader_id) then
    raise exception 'reader_not_found' using errcode = 'P0002';
  end if;

  insert into public.reader_chapter_overrides (reader_id, chapter_id, hidden, body_override, note)
  values (
    p_reader_id,
    v_chapter_id,
    coalesce(p_hidden, false),
    v_body,
    nullif(btrim(p_note), '')
  )
  on conflict (reader_id, chapter_id) do update
  set hidden = excluded.hidden,
      body_override = excluded.body_override,
      note = excluded.note,
      updated_at = now();
end;
$$;

revoke execute on function public.admin_reader_chapters(uuid, text) from public, anon;
revoke execute on function public.admin_set_chapter_override(uuid, text, int, boolean, text, text) from public, anon;
grant execute on function public.admin_reader_chapters(uuid, text) to authenticated;
grant execute on function public.admin_set_chapter_override(uuid, text, int, boolean, text, text) to authenticated;

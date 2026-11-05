-- The owner can take a book down without deleting anything: books.active.
-- A book that is not active disappears from every library, cannot be opened
-- (chapters, contents, progress) and its figures are no longer served. Its
-- chapters, entitlements and readers' places stay, so putting it back up
-- restores everything. Nothing is ever deleted (CLAUDE.md).

alter table public.books add column if not exists active boolean not null default true;

-- Every reader call (book_toc, open_chapter, save_progress) goes through this.
create or replace function public.entitled_book(p_reader_id uuid, p_book_slug text)
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
    and e.active
    and b.active;

  if not found then
    raise exception 'not_entitled' using errcode = '42501';
  end if;

  return v_book;
end;
$$;

-- Figures follow the book.
create or replace function public.can_read_book_files(p_book_slug text)
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
      and b.active
  );
$$;

-- The library leaves out books the owner has taken down.
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
    where e.reader_id = v_reader.id and e.active and b.active
  ), '[]'::jsonb);
end;
$$;


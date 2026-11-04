-- Books grouped by personality type in the library: each book belongs to a
-- type (e.g. INFJ-T-H) and is one kind of book for it: the encyclopedia, the
-- novel, or the appendices.

alter table public.books
  add column type_code text check (type_code ~ '^[A-Z]{4}(-[A-Z]){0,2}$'),
  add column kind text not null default 'encyclopedia'
    check (kind in ('encyclopedia', 'novel', 'appendix'));

update public.books set type_code = 'INFJ-T-H', kind = 'encyclopedia' where slug = 'infj-t-h-reader';
update public.books set type_code = 'INFJ-T-H', kind = 'novel' where slug = 'infj-t-h-novel';
update public.books set type_code = 'INFJ-T-H', kind = 'appendix' where slug = 'infj-t-h-appendix';

-- The reader's books, now with their type and kind. Same checks as before.
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
        'chapters', (select count(*) from public.chapters c where c.book_id = b.id),
        'position', (
          select c.position
          from public.reading_state s
          join public.chapters c on c.id = s.chapter_id
          where s.reader_id = v_reader.id and s.book_id = b.id
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

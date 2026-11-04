-- The owner panel also shows each reader's last sign-in (from Supabase Auth)
-- and the invitations nobody has used yet, so the owner can resend a welcome.
-- Same check as before: only an admin may call it.

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

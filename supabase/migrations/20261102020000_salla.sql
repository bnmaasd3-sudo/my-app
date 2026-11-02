-- Salla: a paid order unlocks the matching book for the buyer's email; a
-- cancelled or refunded order locks it again. The webhook runs on the server
-- with the service role; only the owner panel functions are open to
-- signed-in users, and they check assert_admin() first.

-- Which Salla product (by SKU) is which book.
create table public.salla_products (
  sku text primary key check (sku <> ''),
  book_id uuid not null references public.books (id),
  updated_at timestamptz not null default now()
);

create index salla_products_book_id_idx on public.salla_products (book_id);

-- Which books each order unlocked, so a refund locks exactly those.
create table public.salla_orders (
  order_id text not null,
  reader_id uuid not null references public.readers (id),
  book_id uuid not null references public.books (id),
  created_at timestamptz not null default now(),
  primary key (order_id, book_id)
);

create index salla_orders_reader_id_idx on public.salla_orders (reader_id);
create index salla_orders_book_id_idx on public.salla_orders (book_id);

-- Every webhook received, without payment details or addresses.
create table public.salla_events (
  id bigint generated always as identity primary key,
  dedupe_key text not null unique,
  received_at timestamptz not null default now(),
  event text not null,
  order_id text,
  status text,
  email text,
  skus text[] not null default '{}',
  outcome text not null default 'received',
  detail text
);

alter table public.salla_products enable row level security;
alter table public.salla_orders enable row level security;
alter table public.salla_events enable row level security;
revoke all on public.salla_products, public.salla_orders, public.salla_events from anon, authenticated;

-- Gives the buyer the books in their order. p_user_id is the sign-in account
-- the server found or created for p_email.
create function public.salla_grant_order(
  p_order_id text,
  p_user_id uuid,
  p_email text,
  p_name text,
  p_skus text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_books text[];
  v_unknown text[];
begin
  if not exists (
    select 1 from auth.users u where u.id = p_user_id and lower(u.email) = lower(p_email)
  ) then
    raise exception 'account_mismatch' using errcode = '22023';
  end if;

  -- A reader the owner suspended stays suspended; a purchase does not undo it.
  insert into public.readers (id, email, display_name, active)
  values (p_user_id, lower(p_email), nullif(trim(p_name), ''), true)
  on conflict (id) do update
  set display_name = coalesce(public.readers.display_name, excluded.display_name);

  insert into public.entitlements (reader_id, book_id, active, source)
  select p_user_id, p.book_id, true, 'salla'
  from public.salla_products p
  where p.sku = any (p_skus)
  on conflict (reader_id, book_id) do update
  set active = true,
      updated_at = now();

  insert into public.salla_orders (order_id, reader_id, book_id)
  select p_order_id, p_user_id, p.book_id
  from public.salla_products p
  where p.sku = any (p_skus)
  on conflict do nothing;

  select coalesce(array_agg(distinct b.slug), '{}') into v_books
  from public.salla_products p join public.books b on b.id = p.book_id
  where p.sku = any (p_skus);

  select coalesce(array_agg(s), '{}') into v_unknown
  from unnest(p_skus) s
  where not exists (select 1 from public.salla_products p where p.sku = s);

  return jsonb_build_object('books', to_jsonb(v_books), 'unknown_skus', to_jsonb(v_unknown));
end;
$$;

-- Locks again what this order unlocked. Links the owner made by hand
-- (source 'manual') are left alone; nothing is deleted.
create function public.salla_revoke_order(p_order_id text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
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
  return v_count;
end;
$$;

revoke execute on function public.salla_grant_order(text, uuid, text, text, text[]) from public, anon, authenticated;
revoke execute on function public.salla_revoke_order(text) from public, anon, authenticated;
grant execute on function public.salla_grant_order(text, uuid, text, text, text[]) to service_role;
grant execute on function public.salla_revoke_order(text) to service_role;

-- Owner panel: product mapping and the latest webhooks.
create function public.admin_salla()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object('sku', p.sku, 'book', b.slug, 'title', b.title) order by p.sku)
      from public.salla_products p join public.books b on b.id = p.book_id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb order by x.received_at desc)
      from (
        select e.received_at, e.event, e.order_id, e.status, e.email, e.skus, e.outcome, e.detail
        from public.salla_events e
        order by e.received_at desc
        limit 20
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

create function public.admin_set_salla_product(p_sku text, p_book_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book_id uuid;
begin
  perform public.assert_admin();

  if coalesce(trim(p_sku), '') = '' then
    raise exception 'sku_required' using errcode = '22023';
  end if;
  select b.id into v_book_id from public.books b where b.slug = p_book_slug;
  if not found then
    raise exception 'book_not_found' using errcode = 'P0002';
  end if;

  insert into public.salla_products (sku, book_id)
  values (trim(p_sku), v_book_id)
  on conflict (sku) do update
  set book_id = excluded.book_id,
      updated_at = now();
end;
$$;

revoke execute on function public.admin_salla() from public, anon;
revoke execute on function public.admin_set_salla_product(text, text) from public, anon;
grant execute on function public.admin_salla() to authenticated;
grant execute on function public.admin_set_salla_product(text, text) to authenticated;

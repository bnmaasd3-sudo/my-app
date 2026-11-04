-- Kept identical to the block in docs/runbook.md (checked by access-rules.test.ts).
do $$
declare
  v_email text := lower('reader@example.com');  -- the reader's email
  v_id uuid;
begin
  select id into v_id from public.readers where email = v_email;
  delete from public.test_results where user_id = v_id or key like v_id::text || '__old_%';
  delete from public.reading_log where reader_id = v_id;
  delete from public.reading_state where reader_id = v_id;
  delete from public.reader_prefs where reader_id = v_id;
  delete from public.devices where reader_id = v_id;
  delete from public.salla_orders where reader_id = v_id;
  delete from public.entitlements where reader_id = v_id;
  delete from public.readers where id = v_id;
  delete from public.pending_entitlements where email = v_email;
  delete from public.invites where email = v_email;
  delete from public.salla_events where email = v_email;
end $$;

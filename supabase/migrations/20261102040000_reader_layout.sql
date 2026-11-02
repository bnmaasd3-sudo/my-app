-- Reading layout: "auto" follows the screen width; "mobile" and "laptop"
-- are the reader's own choice, saved with their other preferences.
alter table public.reader_prefs
  add column layout text not null default 'auto' check (layout in ('auto', 'mobile', 'laptop'));

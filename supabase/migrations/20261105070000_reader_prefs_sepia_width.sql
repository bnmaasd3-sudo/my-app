-- Two more reading choices, kept per reader like the others: a sepia
-- (paper) theme, and the width of the text column (narrow, medium, wide).

alter table public.reader_prefs drop constraint if exists reader_prefs_theme_check;
alter table public.reader_prefs
  add constraint reader_prefs_theme_check check (theme in ('system', 'light', 'dark', 'sepia'));

alter table public.reader_prefs
  add column if not exists width text not null default 'md' check (width in ('narrow', 'md', 'wide'));

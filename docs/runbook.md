# دليل المالك · Runbook

## إضافة كتاب

1. ضع فصول الكتاب في مجلد خارج المستودع (ملف Markdown لكل فصل، أوله `# عنوان الفصل`، وسطر الدعم في أول الكتاب فقط).
2. افحصه بلا كتابة:
   `node scripts/import-book.mjs --dir <المجلد> --slug infj-t-h-novel --title "<العنوان>" --type INFJ-T-H --kind novel`
   (`--kind`: `encyclopedia` أو `novel` أو `appendix`؛ وبلا `--type` يظهر الكتاب في «كتب أخرى».)
3. إن نجح الفحص أعده مع `--out <ملف.sql خارج المستودع>`، ونفّذ الملف مرة واحدة في Supabase ← SQL Editor.
4. الأشكال (إن وجدت): ارفعها إلى مستودع `figures` في Supabase Storage تحت `<slug>/figures/`.
5. اربط الكتاب بالقراء من لوحة المالك، أو بمنتج في سلة (docs/salla.md).

## نسخة قارئ تختلف عن غيره

الكتاب واحد لكل من يملكه، ويمكن تخصيصه لقارئ بعينه دون رفعه مرة أخرى: في لوحة المالك، تحت القارئ، افتح «تخصيص الفصول» للكتاب.
- ألغِ «يظهر له» لتُخفي فصلًا عنه: لا يظهر في الفهرس ولا العدد ولا السابق/التالي، ولا يفتح برقمه.
- «استبدال النص» يعطيه نصًا آخر لذلك الفصل (بصيغة الكتاب نفسها)، وفارغًا يعود إلى النص المشترك.
- الملاحظة لك وحدك ولا يراها القارئ.

لنسخة مختلفة كليًا: أدخلها كتابًا مستقلًا باسم (slug) جديد بـ `scripts/import-book.mjs`، واربطها بذلك القارئ وحده.

## إضافة مالك ثانٍ

على جهازك، بمفتاح الخدمة في متغيرات البيئة (لا في ملف):

`SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/add-admin.mjs --email <البريد>`

هذا يعرض ما سيحدث فقط. إن كان صحيحًا فأعده وأضف `--yes` في آخره لينفَّذ. إن لم يكن للبريد حساب يُدعى، ويصير مالكًا عند أول دخول.

## طلب حذف الحساب

التطبيق لا يحذف شيئًا من تلقاء نفسه: الإيقاف من اللوحة يمنع الدخول ويُبقي البيانات. فإن طلب قارئ حذف حسابه وبياناته (كما تَعِد سياسة الخصوصية):

1. تأكد أن الطلب من صاحب البريد نفسه (رد على رسالته من البريد ذاته).
2. أوقفه من لوحة المالك فورًا.
3. في Supabase ← SQL Editor نفّذ هذا بعد أن تضع بريده في السطر الثاني:

```sql
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
```

4. ثم Supabase ← Authentication ← Users ← ابحث عن بريده ← Delete user.
5. أخبره بالرد أن الحذف تم.

## النسخ الاحتياطية

- في Supabase ← Database ← Backups تجد النسخ اليومية إن كانت خطتك تشملها، ومنها الاسترجاع (Restore) إلى تاريخ سابق. الاسترجاع يرجع القاعدة كلها، فما حدث بعد ذلك التاريخ يضيع؛ صدّر ما تحتاجه أولًا.
- إن لم تشمل خطتك النسخ، فخذ نسخة دورية بنفسك: `supabase db dump --db-url "<رابط الاتصال>" -f backup.sql` (Supabase CLI)، واحفظها خارج المستودع.
- الكتب نفسها عندك في مجلداتها الأصلية، فيمكن إعادة إدخالها دائمًا.

## إن تعطّل الدخول

افحص بالترتيب:

1. **Vercel:** Settings ← Deployment Protection: «Vercel Authentication» متوقفة، وإلا لا يفتح الموقع إلا لك.
2. **الرابط:** `NEXT_PUBLIC_SITE_URL` في Vercel هو عنوان الموقع الحالي، وفي Supabase ← Authentication ← URL Configuration: Site URL هو نفسه، وفي Redirect URLs: `<الموقع>/ar/auth/callback` و`<الموقع>/en/auth/callback`.
3. **البريد لا يصل:** بريد Supabase المدمج محدود العدد. اضبط Custom SMTP بحساب Resend (القسم «البريد · Email» في README)، وانظر Supabase ← Logs ← Auth.
4. **«لم يصلني شيء» لبريد جديد:** لا يُنشأ حساب إلا لبريد مدعو. أضفه من لوحة المالك أولًا.
5. **القارئ موقوف أو بلغ حد الجهازين:** من لوحة المالك أعد تفعيله أو ألغِ جهازًا قديمًا.

## حين تشتري نطاقًا خاصًا

1. **Vercel:** Settings ← Domains ← أضف النطاق واتبع تعليمات DNS. ثم غيّر `NEXT_PUBLIC_SITE_URL` إلى العنوان الجديد وأعد النشر.
2. **Supabase:** Authentication ← URL Configuration: Site URL الجديد، وأضف رابطي `/ar/auth/callback` و`/en/auth/callback` بالنطاق الجديد (أبقِ القديمين حتى ينتقل الجميع).
3. **Resend:** Domains ← أضف النطاق وأضف سجلات DNS التي يعطيك إياها حتى يصير «Verified». ثم غيّر `MAIL_FROM` في Vercel، والمرسل في Custom SMTP في Supabase.
4. **سلة:** غيّر رابط الإشعار إلى `https://<النطاق>/api/salla/webhook`.
5. **التطبيقان:** في GitHub ← Settings ← Secrets and variables ← Actions ← Variables أضف `QARI_URL` بالعنوان الجديد، ثم ابنِ أندرويد من جديد (docs/android.md) وiOS (docs/ios.md)، وارفع الإصدار الجديد إلى المتجرين. وحدّث القيمة الافتراضية في `capacitor.config.ts`.
6. **المتجران:** حدّث رابط سياسة الخصوصية فيهما.

## In English

A deletion request is handled by hand: suspend the reader, run the SQL block above with their email, then delete the user in Supabase Authentication. Add a book with `scripts/import-book.mjs` (check first, then `--out` a SQL file outside the repo and run it once in the SQL editor). To give one reader a different copy of a shared book, open "Customise chapters" under them in the owner panel: untick a chapter to hide it from them (gone from the contents, the count, previous/next and its URL) or give it their own text; empty text means the shared one. A wholly different edition is its own book slug, imported with `scripts/import-book.mjs` and linked to that reader only. Add a second owner with `scripts/add-admin.mjs` using the service key from the environment (it is a dry run until you add `--yes`). Backups: Supabase Database → Backups when your plan includes them, otherwise a regular `supabase db dump`. If sign-in breaks, check Vercel Deployment Protection, the site URL in Vercel and Supabase (Site URL and both `/auth/callback` redirects), email delivery (Custom SMTP through Resend), and that the email is invited and active. For a new domain: Vercel domain and `NEXT_PUBLIC_SITE_URL`, Supabase URLs, Resend domain and `MAIL_FROM`, the Salla webhook URL, `QARI_URL` and rebuilt apps, and the privacy link in both stores.

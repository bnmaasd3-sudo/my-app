# دليل المالك · Runbook

## إضافة كتاب

1. ضع فصول الكتاب في مجلد خارج المستودع (ملف Markdown لكل فصل، أوله `# عنوان الفصل`، وسطر الدعم في أول الكتاب فقط).
2. افحصه بلا كتابة:
   `node scripts/import-book.mjs --dir <المجلد> --slug infj-t-h-novel --title "<العنوان>" --type INFJ-T-H --kind novel`
   (`--kind`: `encyclopedia` أو `novel` أو `appendix`؛ وبلا `--type` يظهر الكتاب في «كتب أخرى».)
3. إن نجح الفحص أعده مع `--out <ملف.sql خارج المستودع>`، ونفّذ الملف مرة واحدة في Supabase ← SQL Editor.
4. الأشكال (إن وجدت): ارفعها إلى مستودع `figures` في Supabase Storage تحت `<slug>/figures/`.
5. اربط الكتاب بالقراء من لوحة المالك، أو بمنتج في سلة (docs/salla.md).

## إضافة مالك ثانٍ

على جهازك، بمفتاح الخدمة في متغيرات البيئة (لا في ملف):

`SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/add-admin.mjs --email <البريد>`

إن لم يكن للبريد حساب يُدعى، ويصير مالكًا عند أول دخول.

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

Add a book with `scripts/import-book.mjs` (check first, then `--out` a SQL file outside the repo and run it once in the SQL editor). Add a second owner with `scripts/add-admin.mjs` using the service key from the environment. Backups: Supabase Database → Backups when your plan includes them, otherwise a regular `supabase db dump`. If sign-in breaks, check Vercel Deployment Protection, the site URL in Vercel and Supabase (Site URL and both `/auth/callback` redirects), email delivery (Custom SMTP through Resend), and that the email is invited and active. For a new domain: Vercel domain and `NEXT_PUBLIC_SITE_URL`, Supabase URLs, Resend domain and `MAIL_FROM`, the Salla webhook URL, `QARI_URL` and rebuilt apps, and the privacy link in both stores.

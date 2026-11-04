# سَجيّة · Sajiyya

تطبيق يقرأ فيه المشتري كتابه بعد تسجيل الدخول، بلا ملفات تُحمَّل أو تُرسل. الواجهة بالعربية والإنجليزية.

A reading app where buyers read their book after signing in, with no files to download or forward. Arabic and English interface.

## التشغيل · Getting started

```bash
npm install
npm run dev        # http://localhost:3000  →  /ar  أو / or  /en
npm test           # الاختبارات · tests
npm run lint       # فحص الكود · lint
npm run typecheck  # فحص الأنواع · type check
```

قواعد المشروع في [`CLAUDE.md`](CLAUDE.md)، والميزانية في [`docs/budget.md`](docs/budget.md).

Project rules live in [`CLAUDE.md`](CLAUDE.md); the budget is tracked in [`docs/budget.md`](docs/budget.md).

## البريد · Email

التطبيق يرسل رسالة ترحيب حين يضيف المالك قارئًا (ومعها زر «إعادة إرسال الترحيب» في لوحة المالك)، ويرسل Supabase رموز الدخول وروابطه. الاثنان يخرجان من حساب Resend واحد:

1. **النطاق في Resend:** أنشئ حسابًا في resend.com، ومن Domains أضف نطاقك (مثل `sajiyya.com`)، وضع سجلات DNS التي يعطيك إياها (SPF وDKIM) عند مزوّد النطاق، وانتظر حتى يصير «Verified».
2. **المفتاحان في Vercel:** من API Keys في Resend أنشئ مفتاحًا (Sending access). ثم في Vercel: المشروع ← Settings ← Environment Variables، أضف:
   - `RESEND_API_KEY` = المفتاح (`re_...`).
   - `MAIL_FROM` = المرسل، مثل `سَجيّة <hello@sajiyya.com>`، على النطاق الموثَّق.
   ولا تبدأ أيّهما بـ `NEXT_PUBLIC_`. ثم أعد النشر (Redeploy).
3. **Custom SMTP في Supabase Auth:** في Supabase: Authentication ← Emails ← SMTP Settings، فعّل Custom SMTP بالقيم:
   - Host: `smtp.resend.com`، Port: `465`، Username: `resend`، Password: مفتاح Resend نفسه.
   - Sender email: عنوان على النطاق الموثَّق، وSender name: `سَجيّة`.
   بعدها تصل رسائل الدخول من نطاقك، ويرتفع حدّ الإرسال عن حدّ Supabase المجاني، ويصير بإمكانك وضع `{{ .Token }}` في قالب «Magic Link» ليصل الرمز مع الرابط.

بلا هذين المتغيرين يعمل التطبيق كما هو ولا يرسل ترحيبًا، وتقول لوحة المالك ذلك عند إضافة القارئ.

The app sends a welcome email when the owner adds a reader; Supabase sends the sign-in codes and links. Both go out through one Resend account: verify your domain in Resend (DNS records), add `RESEND_API_KEY` and `MAIL_FROM` to Vercel's environment variables (server only), and in Supabase Auth → SMTP Settings enable Custom SMTP with host `smtp.resend.com`, port `465`, user `resend` and the Resend key as password.

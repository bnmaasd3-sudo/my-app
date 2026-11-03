---
name: access-rules
description: صلاحيات «قارئ» — من يرى ماذا، وقواعد Supabase (RLS)، وقيد الجهازين، والاختبار الثابت لرفض فتح كتاب غير مملوك. Use for any work on accounts, sign-in, sessions, permissions, RLS policies, devices, or anything that decides who can read a chapter.
---

# الصلاحيات

## من يرى ماذا
| الدور | يرى | لا يرى |
|---|---|---|
| زائر غير مسجَّل | الصفحة الرئيسية وصفحة الدخول | أي فصل، أي عنوان كتاب غير معلن |
| قارئ نشط | فصول الكتب المربوطة بحسابه فقط، وموضع قراءته | كتب غيره، بيانات غيره |
| قارئ معطَّل | صفحة «حسابك موقوف» | أي فصل |
| المدير (صاحب المشروع) | اللوحة: القراء، الربط، السجلات | — |

## المبادئ
- **التحقق في الخادم وفي القاعدة**، لا في المتصفح. إخفاء زر ليس صلاحية.
- **RLS مفعّل على كل جدول** فيه بيانات قارئ أو نص كتاب، بلا استثناء.
- مفتاح الخدمة (service role) يُستعمل في الخادم فقط، من متغير بيئة لا يبدأ بـ `NEXT_PUBLIC_`.
- لا حذف: الحساب والربط يُعطَّلان (`active = false`) ولا يُحذفان.

## المخطط (المرجع: `supabase/migrations/`، والاختبارات: `supabase/tests/access-rules.test.ts`)
- `readers`: `id` (= `auth.users.id`)، `email`، `display_name`، `active`، `created_at`
- `entitlements`: `reader_id`، `book_id`، `active`، `source` (سلة / يدوي)، `created_at`
- `devices`: `reader_id`، `device_id`، `last_seen`، `revoked`
- `reading_log`: `reader_id`، `chapter_id`، `opened_at`، `device_id`
- `admins`: `user_id`. المالك يدير القراء عبر دوال `admin_*` (كل منها يبدأ بـ `assert_admin()`)، ولا قراءة مباشرة لهذا الجدول.

## الحسابات
- لا يُنشأ حساب دخول إلا لبريد في جدول `invites`. المشغّل `guard_new_user` على `auth.users` يرفض غيره، ويمحو أي كلمة مرور، لأن الدخول برمز البريد وحده. وبهذا لا يستفيد أحد إن سجّل ببريد مشترٍ وكلمة مرور قبله.
- تنشأ الدعوة من ثلاثة مصادر:
  - لوحة المالك (`admin_add_reader`).
  - سلة (`salla_grant_email`).
  - السكربتان `scripts/add-reader.mjs` و`scripts/add-admin.mjs`.
- إن لم يكن للمدعو حساب، يُحفظ كتابه في `pending_entitlements`، ويُفتح عند أول دخول بالمشغّل `activate_new_user`.
- مفتاح الخدمة لا يحتاجه إلا إشعار سلة على الخادم.
- الأشكال في مستودع `figures` الخاص، تحت المسار `<slug>/figures/<file>`. قاعدة `storage.objects` لا تسمح بقراءتها إلا لمن يملك الكتاب (`can_read_book_files`)، والشاشة تطلب روابط موقّعة مدتها عشر دقائق.

## كيف يصل القارئ إلى الفصل
لا قاعدة `select` على `chapters` أصلًا، والصلاحيات مسحوبة منها لـ `anon` و`authenticated`. القارئ يأخذ الفصل فقط عبر الدالة `public.open_chapter(slug, position, device_id)` (security definer)، وهي تتحقق من الحساب والربط والجهاز، وتسجّل القراءة، وتعيد اسم القارئ وبريده للعلامة المائية. الفهرس عبر `book_toc`، والمكتبة عبر `my_library`، وحفظ الموضع عبر `save_progress`.
الاختبارات تشغّل ملفات الترحيل على Postgres في الذاكرة (PGlite) بأدوار تحاكي Supabase، فلا تحتاج اتصالًا.

## صيغة بديلة (غير مستعملة الآن) لقاعدة وصول مباشرة
```sql
alter table chapters enable row level security;

create policy "readers read chapters of books they own"
on chapters for select
to authenticated
using (
  exists (
    select 1
    from entitlements e
    join readers r on r.id = e.reader_id
    where e.reader_id = (select auth.uid())
      and e.book_id = chapters.book_id
      and e.active
      and r.active
  )
);
```
لا قاعدة `insert`/`update`/`delete` للقراء على `chapters` و`books`؛ الكتابة بمفتاح الخدمة فقط.

## قيد الجهازين
- عند الدخول يُسجَّل معرّف الجهاز في `devices`.
- إن كان للحساب جهازان نشطان، يُرفض الثالث برسالة واضحة (بالعربية والإنجليزية)، ويرى المدير ذلك في اللوحة ويستطيع إلغاء جهاز قديم.
- الفحص في الخادم عند كل طلب فصل، لا عند الدخول وحده.

## الاختبارات الثابتة (لا تُحذف ولا تُعطَّل أبدًا)
1. قارئ INFJ يطلب فصلًا من كتاب ESFJ ← يُرفض (لا نص في الرد).
2. زائر غير مسجَّل يطلب فصلًا ← يُرفض.
3. قارئ معطَّل يطلب فصلًا من كتابه ← يُرفض.
4. ربط معطَّل (استرجاع) ← يُرفض.
5. جهاز ثالث ← يُرفض.
6. قارئ يطلب فصلًا من كتابه ← يُقبل، ومعه اسمه وبريده لتذييل الفصل.

بعد أي تغيير في الصلاحيات شغّل أداة Supabase `get_advisors` (نوع security) وأصلح كل تحذير.

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

## المخطط المخطَّط له (المرجع النهائي: `supabase/migrations/`)
- `readers`: `id` (= `auth.users.id`)، `email`، `display_name`، `active`، `created_at`
- `entitlements`: `reader_id`، `book_id`، `active`، `source` (سلة / يدوي)، `created_at`
- `devices`: `reader_id`، `device_id`، `last_seen`، `revoked`
- `reading_log`: `reader_id`، `chapter_id`، `opened_at`، `device_id`

## صيغة قاعدة الوصول للفصول
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
6. قارئ يطلب فصلًا من كتابه ← يُقبل، وعليه العلامة المائية باسمه.

بعد أي تغيير في الصلاحيات شغّل أداة Supabase `get_advisors` (نوع security) وأصلح كل تحذير.

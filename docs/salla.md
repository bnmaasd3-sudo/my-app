# تفعيل سلة · Salla

الكود جاهز (`src/app/api/salla/webhook` و`src/lib/salla.ts`): حين يصل إشعار طلب مدفوع من سلة يُفتح الكتاب للمشتري ببريده، وحين يُلغى الطلب أو يُسترجع يُقفل ما فتحه. ينقص الربط من جهة سلة وحدها.

> أسماء الشاشات في سلة تتغير. إن اختلف ما تراه عمّا هنا، فالمرجع وثائق سلة: docs.salla.dev (Webhooks).

## الخطوات

1. **المنتج:** في متجر سلة أنشئ منتجًا للكتاب (منتج رقمي)، واكتب له **رمز SKU** واضحًا، مثل `INFJ-T-H-READER`.
2. **مفتاح الخدمة:** في Supabase: Project Settings ← API Keys ← انسخ `service_role` (أو secret key). في Vercel: Settings ← Environment Variables ← أضف `SUPABASE_SERVICE_ROLE_KEY` (سرّي، لا يبدأ بـ `NEXT_PUBLIC_`).
3. **الإشعار (Webhook):** أضف إشعارًا من حيث تتيحه سلة لمتجرك:
   - الرابط: `https://<موقعك>/api/salla/webhook` (يظهر جاهزًا في لوحة المالك تحت «ربط سلة»).
   - الأحداث: أحداث الطلبات (`order.created` و`order.updated` وتغيّر الحالة، و`order.refunded` و`order.cancelled`).
   - الأمان: «Signature» بسرّ تختاره (نص طويل عشوائي). التطبيق يقبل التوقيع في الترويسة `x-salla-signature` (HMAC-SHA256 للجسم)، أو السرّ نفسه بصيغة `Authorization: Bearer`.
4. **السرّ في Vercel:** أضف `SALLA_WEBHOOK_SECRET` بالقيمة نفسها التي وضعتها في سلة، ثم أعد النشر (Redeploy).
5. **ربط المنتج بالكتاب:** في لوحة المالك ← «ربط سلة»: اكتب الـ SKU واختر الكتاب واحفظ.
6. **طلب تجريبي:** اشترِ المنتج ببريد تملكه (أو أنشئ طلبًا تجريبيًا وغيّر حالته إلى «مكتمل»). ثم في لوحة المالك ← «آخر إشعارات سلة» تأكد أن الحدث والحالة والبريد ظهرت، وأن النتيجة «granted» (فُتح الكتاب) أو «invited» (دُعي البريد ويُفتح له حين يدخل). وادخل بذلك البريد وتأكد أن الكتاب في المكتبة.
7. **الاسترجاع:** ألغِ الطلب التجريبي أو استرجعه، وتأكد أن النتيجة «revoked» وأن الكتاب أُقفل.

## ما تعنيه النتائج في اللوحة

| النتيجة | المعنى |
|---|---|
| granted | فُتح الكتاب لقارئ موجود |
| invited | البريد جديد: دُعي، ويُفتح له الكتاب عند أول دخول |
| revoked | أُقفل ما فتحه هذا الطلب |
| unknown_product | الـ SKU غير مربوط بكتاب: اربطه من اللوحة |
| no_email / no_skus | الإشعار بلا بريد أو بلا منتج: راجع إعدادات الإشعار |
| ignored | حدث لا يعني شيئًا للكتب (حالة غير مدفوعة مثلًا) |

الحالات التي تفتح الكتاب افتراضيًا: `in_progress, completed, delivering, delivered, shipped`. ولتغييرها ضع `SALLA_GRANT_STATUSES` في Vercel (مفصولة بفواصل).

## In English

Create a digital product with a clear SKU, add `SUPABASE_SERVICE_ROLE_KEY` and `SALLA_WEBHOOK_SECRET` to Vercel, add a Salla webhook for order events pointing at `https://<site>/api/salla/webhook` with the Signature strategy and the same secret, map the SKU to the book in the owner panel, then place a test order and check "Recent Salla events" (granted or invited), and a refund (revoked).

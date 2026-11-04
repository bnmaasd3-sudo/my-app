# تطبيق أندرويد · Android

مشروع أندرويد في `android/` مولَّد بـ Capacitor، ويفتح الموقع المنشور (`server.url` في `capacitor.config.ts`). منع لقطة الشاشة بـ `FLAG_SECURE` في `MainActivity.java`، والـ workflow يتحقق منه في كل بناء.

## نسخة تجريبية (بلا مفتاح)

Actions ← **Android APK** ← **Run workflow**. يخرج `qari-debug-apk` (ملف APK) تثبّته على هاتفك مباشرة. الموقع الذي يفتحه: مدخل `url` إن كتبته، وإلا متغير المستودع `QARI_URL`، وإلا `https://qari-bnmaasd3-3308.vercel.app`.

## الإصدار الموقّع لمتجر Google Play

### 1. ولّد مفتاح الرفع (مرة واحدة، على جهازك)

```sh
keytool -genkeypair -v -keystore sajiyya-upload.jks -alias sajiyya -keyalg RSA -keysize 2048 -validity 10000
```

يسألك عن كلمتي مرور (للملف وللمفتاح) واسمك. **احفظ الملف وكلمتي المرور في مكان آمن خارج المستودع** (مدير كلمات مرور مثلًا)؛ لا يُرفع الملف إلى Git أبدًا.

### 2. ضع المفتاح في أسرار المستودع

حوّل الملف إلى نص: `base64 -w0 sajiyya-upload.jks` (على ماك: `base64 -i sajiyya-upload.jks`).

ثم في GitHub: Settings ← Secrets and variables ← Actions ← **New repository secret**، أربعة أسرار:

| السر | قيمته |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | ناتج أمر base64 |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور الملف |
| `ANDROID_KEY_ALIAS` | `sajiyya` (أو ما اخترته في `-alias`) |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح |

### 3. ابنِ الإصدار

Actions ← **Android APK** ← **Run workflow**. حين توجد الأسرار الأربعة يخرج أيضًا `sajiyya-release` وفيه `app-release.aab` (للمتجر) و`app-release.apk` (موقّع). وبلا الأسرار، أو في طلبات الدمج، يبقى البناء على النسخة التجريبية وحدها؛ وفي طلبات الدمج يُجرَّب التوقيع بمفتاح مؤقت لا بمفتاحك.

رقم الإصدار (`versionCode`) هو رقم تشغيل هذا الـ workflow، فيزيد مع كل بناء كما يشترط المتجر. فابنِ الإصدارات من هنا لا من جهازك (البناء خارج CI يأخذ الرقم 1)، ولا تحذف الـ workflow ولا تغيّر اسم ملفه، لأن ذلك يعيد العدّ من أوله فيرفض المتجر الأرقام الأصغر.

### 4. Google Play Console

1. حساب مطوّر في Google Play Console (رسوم تسجيل لمرة واحدة).
2. **Create app**: الاسم «سَجيّة»، اللغة الافتراضية العربية، تطبيق مجاني (البيع من متجر سلة خارج التطبيق؛ لا تضع داخل التطبيق زر شراء).
3. **App category**: Books & Reference.
4. **Privacy policy**: `https://<موقعك>/ar/privacy`.
5. **Data safety** (أجب بما يفعله التطبيق فعلًا):
   - يجمع: البريد الإلكتروني والاسم (إدارة الحساب)، ومعرّف الجهاز (جهازان لكل حساب)، ونشاط التطبيق: سجل القراءة وإجابات الاختبار (وظائف التطبيق).
   - لا يشارك البيانات مع أطراف ثالثة لأغراضها، ولا إعلانات.
   - البيانات مشفّرة أثناء النقل (HTTPS).
   - يستطيع المستخدم طلب حذف بياناته بالبريد (مذكور في سياسة الخصوصية).
6. **Content rating**: املأ الاستبيان (كتب وقراءة، بلا محتوى عنيف).
7. **Target audience**: اختر الأعمار التي تبيع لها. في الاختبار ورقة لمن هم من 13 إلى 17 سنة، فإن شملتهم فراجع متطلبات Google للمراهقين.
8. **App access**: أعطِ المراجِع حسابًا تجريبيًا: بريدًا مدعوًا (أضفه من لوحة المالك) ويصله رمز الدخول، واشرح ذلك في الملاحظات.
9. **App signing**: اقبل Play App Signing. ملفك هو «مفتاح الرفع»، وGoogle تحفظ مفتاح التوقيع النهائي.
10. **الاختبار المغلق** (Testing ← Closed testing): ارفع `app-release.aab`، وأضف بريد المختبرين. الحسابات الشخصية الجديدة تشترط عددًا من المختبرين لمدة متصلة قبل النشر العام (راجع الرقم الحالي في Play Console)، ثم اطلب الوصول إلى الإنتاج.

## In English

Debug builds need nothing: run the **Android APK** workflow. For Google Play, generate an upload key once with the `keytool` command above, store it safely outside the repo, and add four repository secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). The workflow then also uploads `sajiyya-release` with a signed AAB and APK; `versionCode` is the run number. On pull requests the signing path is checked with a throwaway key. In Play Console: free app (sales happen on Salla, outside the app), Books & Reference, privacy policy at `/ar/privacy`, Data safety (email, name, device ID, reading activity; not shared; encrypted in transit; deletion on request), content rating, a test account for review, Play App Signing, then closed testing before production.

# تطبيق آيفون · iOS

مشروع iOS في `ios/` مولَّد بـ Capacitor (`npx cap add ios`)، ويفتح الموقع المنشور كما يفعل تطبيق أندرويد (`server.url` في `capacitor.config.ts`، والقيمة الافتراضية `https://qari-bnmaasd3-3308.vercel.app`، ويغيّرها المتغير `QARI_URL` عند المزامنة).

## الحماية من التصوير

في iOS لا يوجد ما يعادل FLAG_SECURE في أندرويد، فالحماية في `ios/App/App/SceneDelegate.swift` من طبقتين:

1. **لقطة الشاشة:** محتوى التطبيق يوضع داخل الطبقة التي يُخفيها iOS من اللقطات لحقول كلمات المرور الآمنة، فتظهر اللقطة فارغة، وكذلك صورة التطبيق في مبدّل التطبيقات. هذه طريقة شائعة لا واجهة رسمية من آبل؛ إن غيّر إصدار قادم من iOS تلك الطبقة يعمل التطبيق كما هو بلا هذه الحماية، فجرّبها مع كل إصدار جديد من iOS.
2. **تسجيل الشاشة والعرض على شاشة أخرى:** ما دام iOS يقول إن الشاشة تُسجَّل أو تُعرض (`UIScreen.capturedDidChangeNotification`) يغطي التطبيق المحتوى بلون الخلفية، ويرجع حين يتوقف التسجيل.

ولا تعتيم عند ترك التطبيق أو فقدان التركيز (قرار المالك: يزعج القارئ). ويبقى سطر اسم القارئ في تذييل كل فصل.

**جرّبها على هاتف حقيقي قبل كل إصدار:** خذ لقطة شاشة في فصل (يجب أن تظهر فارغة أو بلون الخلفية)، وشغّل تسجيل الشاشة من مركز التحكم (يجب أن يغطي التطبيق المحتوى)، وتأكد أن اللمس والتمرير يعملان. فحص CI لا يستطيع أخذ لقطة، فهو يتحقق من أن الحماية موصولة فقط.

## البناء والنشر (على جهاز ماك)

يحتاج: ماك عليه Xcode حديث، وحساب Apple Developer (99 دولارًا سنويًا).

1. `npm ci` ثم `npx cap sync ios` (ولموقع آخر: `QARI_URL=https://... npx cap sync ios`).
2. `npx cap open ios` يفتح المشروع في Xcode.
3. في Xcode: الهدف App ← Signing & Capabilities ← اختر فريقك (Team). المعرّف `app.qari.reader` كما في أندرويد.
4. للتجربة على هاتف: وصّله واضغط Run. وللتوزيع: Product ← Archive ← Distribute App ← App Store Connect، ثم TestFlight للمجرّبين.
5. الأيقونة في `ios/App/App/Assets.xcassets/AppIcon.appiconset` (1024×1024 بلا شفافية) مأخوذة من `src/app/icon.svg`؛ إن تغيّرت الأيقونة فحدّثها هناك أيضًا.

يتحقق `.github/workflows/ios.yml` من أن المشروع يُبنى للمحاكي بلا توقيع في كل طلب دمج يمسّ `ios/`، ويُشغَّل يدويًا من Actions.

## قبل الرفع إلى App Store

- **إرشاد 4.2 (الحد الأدنى من الوظائف):** آبل ترفض أحيانًا التطبيقات التي هي موقع داخل غلاف. خفّف الخطر بوصف واضح لما يقدمه التطبيق (قراءة محمية لكتب اشتراها القارئ، وحفظ الموضع، والاختبار)، وبحساب تجريبي للمراجِع في App Store Connect (بريد مدعو، ورمز الدخول يصله).
- **الشراء:** البيع من متجر سلة خارج التطبيق. لا تضع داخل تطبيق iOS رابطًا أو زرًا للشراء، وإلا طلبت آبل الشراء داخل التطبيق (In-App Purchase).
- **الخصوصية:** املأ «App Privacy» (البريد للدخول، واسم القارئ لتذييل الفصل)، وأضف رابط سياسة الخصوصية.

## In English

`ios/` is the Capacitor iOS app; it opens the deployed site like the Android app. iOS has no FLAG_SECURE, so `SceneDelegate.swift` hides the content from screenshots by placing it inside a secure text field's layer (a widely used technique, not an official API: re-test with each iOS release), and covers it while the screen is recorded or mirrored. Build on a Mac: `npm ci`, `npx cap sync ios`, `npx cap open ios`, set the signing team, then Archive and upload to App Store Connect. Mind guideline 4.2 (wrapped websites), keep purchases outside the app (Salla), and fill in App Privacy.

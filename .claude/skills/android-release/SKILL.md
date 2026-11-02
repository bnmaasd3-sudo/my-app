---
name: android-release
description: إصدار نسخة أندرويد من «قارئ» بـ Capacitor — التغليف، وتفعيل منع لقطة الشاشة (FLAG_SECURE)، والتوقيع، والنسخة التجريبية، وقائمة الفحص قبل المتجر. Use when building an APK/AAB, wrapping the site for Android, enabling screenshot blocking, or preparing a Play Store release (or when the user runs /apk).
---

# إصدار أندرويد

> راجع وثائق Capacitor الحالية (capacitorjs.com/docs) قبل التنفيذ لأرقام الإصدارات والأوامر.

## التغليف
- التطبيق موقع بخادم (تسجيل دخول وفصول من القاعدة)، فيُغلَّف بتوجيه Capacitor إلى الموقع المنشور: `server.url` في `capacitor.config.ts` يشير إلى رابط الإنتاج على Vercel.
- `appId`: `app.qari.reader` (لا يتغير بعد أول رفع للمتجر). `appName`: `قارئ`.
- الحزم: `@capacitor/core` و`@capacitor/cli` و`@capacitor/android`، ثم `npx cap add android` و`npx cap sync android`.

## منع لقطة الشاشة (FLAG_SECURE)
في `android/app/src/main/java/.../MainActivity.java`:
```java
import android.os.Bundle;
import android.view.WindowManager;

@Override
public void onCreate(Bundle savedInstanceState) {
  super.onCreate(savedInstanceState);
  getWindow().setFlags(
    WindowManager.LayoutParams.FLAG_SECURE,
    WindowManager.LayoutParams.FLAG_SECURE
  );
}
```
يمنع اللقطة وتسجيل الشاشة، ويُظهر شاشة سوداء في قائمة التطبيقات الأخيرة.

## الأيقونة والاسم
من `public/icons/icon-512.png` ولون الخلفية `#0f5c5a`. اسم التطبيق «قارئ» بالعربية، و«Qari» للغة الإنجليزية في `strings.xml`.

## التوقيع
- مفتاح التوقيع (keystore) يُنشأ مرة واحدة، ويُحفظ **خارج المستودع**، وكلمته عند صاحب المشروع فقط. ضياعه يعني أن التحديثات لا تُرفع للتطبيق نفسه.
- `*.keystore` و`*.jks` في `.gitignore` قبل إنشائه.

## البناء
- تجريبي: `cd android && ./gradlew assembleDebug` ← `app/build/outputs/apk/debug/app-debug.apk`.
- للمتجر: `./gradlew bundleRelease` ← ملف AAB موقَّع.
- ارفع APK التجريبي حيث يستطيع صاحب المشروع تنزيله على هاتفه، وأعطه الرابط.

## قائمة الفحص قبل المتجر
- [ ] لقطة الشاشة تُمنع فعلًا على هاتف حقيقي (تُجرَّب، لا تُفترض).
- [ ] الدخول، وفتح فصل، والعلامة المائية تعمل داخل التطبيق.
- [ ] رقم الإصدار (`versionCode`) أكبر من السابق.
- [ ] الأيقونة والاسم صحيحان بالعربية والإنجليزية.
- [ ] رابط سياسة الخصوصية جاهز.
- [ ] الرفع أولًا إلى مسار الاختبار الداخلي في Play Console، لا إلى الإنتاج.

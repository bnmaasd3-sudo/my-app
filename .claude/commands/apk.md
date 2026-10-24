---
description: بناء ملف أندرويد تجريبي (APK) وإعطاء رابط تنزيله
---

ابنِ نسخة أندرويد تجريبية باتباع سكِل `android-release`:

1. تأكد أن مجلد `android/` موجود (المرحلة 3). إن لم يوجد، قل ذلك وتوقف.
2. `npx cap sync android` ثم `cd android && ./gradlew assembleDebug`.
3. تحقق أن FLAG_SECURE مفعّل في `MainActivity`.
4. ارفع ملف APK حيث يستطيع صاحب المشروع تنزيله على هاتفه، وأعطه الرابط وخطوات التثبيت.

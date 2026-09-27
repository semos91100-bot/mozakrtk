# تفعيل تسجيل الدخول عبر Google وApple

واجهة الدخول جاهزة وتدفق OAuth يعمل من الخادم، لكن يلزم إنشاء بيانات اعتماد للموقع في لوحات المطورين وربطها بمتغيرات بيئة الاستضافة. لا ترفع هذه القيم داخل ZIP أو Git، ولا تضعها في ملفات JavaScript.

## عنوان الرجوع (Callback)

ضع عنوان موقعك المنشور عبر HTTPS في `OAUTH_BASE_URL`، من دون `/` في النهاية. مثال: `https://example.com`.

عنوان الرجوع نفسه للمزوّدين هو:

`https://example.com/api/oauth.php`

بدّل `example.com` بعنوان نطاق الموقع الفعلي. يجب أن يطابق العنوان المسجل لدى كل مزود حرفيًا. يلزم HTTPS ونطاق حقيقي؛ Apple لا يقبل localhost أو عنوان IP لهذا التدفق.

## Google

1. في [Google Cloud Console](https://console.cloud.google.com/)، أنشئ مشروعًا أو اختر مشروع الموقع.
2. أعد إعداد شاشة موافقة OAuth واسم التطبيق وروابط الخصوصية/الدعم المطلوبة، ثم أضف المستخدمين التجريبيين إذا بقيت الشاشة في وضع الاختبار.
3. أنشئ بيانات اعتماد من نوع **OAuth client ID → Web application**.
4. أضف عنوان الموقع ضمن Authorized JavaScript origins، وأضف `https://example.com/api/oauth.php` إلى **Authorized redirect URIs**.
5. أضف إلى متغيرات بيئة PHP:
   - `GOOGLE_CLIENT_ID` = معرّف العميل.
   - `GOOGLE_CLIENT_SECRET` = سر العميل.

لا تُرسل كلمة مرور Google للموقع؛ التدفق يستخدم authorization code على الخادم ويُتحقق من التوقيع والجمهور ووقت الصلاحية وnonce قبل إنشاء الجلسة.

## Apple

يتطلب تسجيل Apple حساب Apple Developer مفعّلًا وصلاحية إعداد Sign in with Apple.

1. من [Apple Developer](https://developer.apple.com/account/resources/)، فعّل Sign in with Apple لمعرّف التطبيق الأساسي (Primary App ID).
2. أنشئ **Services ID** للموقع، واربطه بمعرّف التطبيق الأساسي.
3. فعّل Sign in with Apple لذلك الـServices ID، وسجّل النطاق الفرعي للموقع وعنوان الرجوع `https://example.com/api/oauth.php` في إعدادات Website URLs.
4. أنشئ مفتاحًا خاصًا لـ Sign in with Apple ونزّل ملف `.p8`؛ أضف بيانات الاعتماد التالية إلى متغيرات بيئة PHP:
   - `APPLE_SERVICE_ID` = الـServices ID المستخدم كـ client ID.
   - `APPLE_TEAM_ID` = Team ID.
   - `APPLE_KEY_ID` = Key ID للمفتاح.
   - `APPLE_PRIVATE_KEY` = محتوى ملف `.p8` كاملًا (من `BEGIN PRIVATE KEY` إلى `END PRIVATE KEY`). إذا كانت لوحة الاستضافة لا تقبل أسطرًا متعددة، خزّنه باستخدام `\\n` بدل فواصل الأسطر.

المفتاح الخاص يبقى سرًا على الخادم. ينشئ الخادم client secret قصير الصلاحية للتحقق من authorization code، ثم يتحقق من توقيع Apple وissuer وaudience وexpiry وnonce.

## متغيرات البيئة المطلوبة

لكلا الخيارين:

```text
OAUTH_BASE_URL=https://example.com
```

لـGoogle: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

لـApple: `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`.

فعّل إضافة PHP cURL وOpenSSL في الاستضافة. عند استخدام التسجيل من Google فقط، لا يلزم إعداد مفاتيح Apple والعكس صحيح. إذا لم تُضف بيانات اعتماد مزود، سيعرض الموقع رسالة إعداد واضحة بدل خطأ عام.

## قواعد ربط الحساب

- يُنشأ حساب واحد للمزوّد عند أول دخول، ويُعاد استخدامه بعد ذلك بمعرّف `sub` الثابت من المزود.
- إذا كان البريد مطابقًا لحساب قديم غير موثّق، لا يدمج النظام الحسابين تلقائيًا؛ يلزم ربط يدوي آمن بدل الاستيلاء على حساب موجود.
- تسجيل Google وApple لا يطلب رقم الهاتف عند الإنشاء؛ يمكن إضافته لاحقًا من صفحة الحساب.
- تخزن هوية المزود ومعرّف المستخدم فقط، ولا تُحفظ رموز OAuth طويلة العمر.
- بيانات المستخدمين تحفظ حيث أُعدّ التخزين في الموقع (Vercel Blob الخاص عند تفعيله، وإلا التخزين المحلي).

## التحقق بعد النشر

1. افتح صفحة الدخول على نطاق HTTPS.
2. جرّب زر Google أو Apple واسمح بالموافقة.
3. تأكد من الرجوع إلى `study.html` ومن ظهور الحساب في «حسابي».
4. جرّب تسجيل الخروج وإعادة الدخول؛ يجب أن يعود إلى الحساب نفسه.

## مراجع المزودين الرسمية

- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Apple: Configure your webpage for Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple)
- [Apple: Verify a user](https://developer.apple.com/documentation/signinwithapple/verifying-a-user)
- [Apple: Validate authorization codes and tokens](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens)

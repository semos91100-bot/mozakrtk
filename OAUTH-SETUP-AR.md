# إعداد تسجيل الدخول عبر Google وApple للحسابات السابقة على Vercel

تدفق OAuth يعمل عبر وظائف Node الموجودة في Vercel، ولا يستخدم ملفات PHP. لا تضع أي بيانات اعتماد في Git أو JavaScript أو ZIP.

إنشاء الحسابات الجديدة عبر Google أوApple متوقف؛ التسجيل الجديد يكون برقم الهاتف وكلمة المرور. إعداد هذا الدليل مخصص فقط لمن لديهم حساب Google/Apple مرتبط مسبقًا.

## عنوان الرجوع

النطاق الحالي: `https://mozakrtk.vercel.app`

- Google Authorized redirect URI: `https://mozakrtk.vercel.app/api/oauth-callback`
- Apple Return URL: `https://mozakrtk.vercel.app/api/oauth-callback`
- أضف `OAUTH_BASE_URL` في Vercel بقيمة `https://mozakrtk.vercel.app` دون شرطة مائلة أخيرة.

إذا استخدمت نطاقًا مخصصًا لاحقًا، استبدل النطاق أعلاه في لوحة المزوّد وفي `OAUTH_BASE_URL`.

## إعداد Google

1. افتح [Google Cloud Console](https://console.cloud.google.com/) وأنشئ OAuth client من النوع **Web application**.
2. في Authorized JavaScript origins أضف `https://mozakrtk.vercel.app`.
3. في Authorized redirect URIs أضف `https://mozakrtk.vercel.app/api/oauth-callback`.
4. أضف متغيري Vercel التاليين للـProduction (وPreview عند الاختبار):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

## إعداد Apple

يتطلب تسجيل Apple حساب Apple Developer نشطًا.

1. فعّل Sign in with Apple وأنشئ Services ID واربطه بـApp ID.
2. في إعداد Website URLs سجّل النطاق `mozakrtk.vercel.app` وعنوان الرجوع `https://mozakrtk.vercel.app/api/oauth-callback`.
3. أنشئ مفتاح Sign in with Apple من نوع `.p8`.
4. أضف متغيرات Vercel التالية للـProduction (وPreview عند الاختبار):
   - `APPLE_SERVICE_ID` — Services ID
   - `APPLE_TEAM_ID` — Team ID
   - `APPLE_KEY_ID` — Key ID
   - `APPLE_PRIVATE_KEY` — محتوى `.p8` كاملًا. إذا كانت لوحة الإعداد لا تقبل أسطرًا متعددة، استخدم `\n` بين الأسطر.

## النشر والاختبار

1. أضف متغيرات المزوّد المطلوب فقط إذا كان هناك مستخدمون سابقون يحتاجون الدخول به؛ Google وApple اختياريان كلٌ على حدة.
2. أعد نشر الموقع في Vercel بعد حفظ المتغيرات.
3. اختبر إنشاء الحساب برقم الهاتف وكلمة المرور، ثم اختبر دخول حساب مرتبط سابقًا بالمزوّد.
4. إذا كان المزود غير مهيأ، تظهر رسالة واضحة بدل خطأ 403.

يستخدم التطبيق `SESSION_SECRET` إن كان مضبوطًا. ولتوافق النسخة الحالية، يستطيع الخادم اشتقاق مفتاح جلسة احتياطي من مفتاح Supabase السري، لكن يُفضّل تعيين `SESSION_SECRET` مستقل عشوائي طويل في Vercel.

## الأمان وربط الحسابات

- يتحقق الخادم من `state` و`nonce` وتوقيع JWT و`issuer` و`audience` ومدة الصلاحية، ولا يستقبل كلمة مرور Google أو Apple.
- يُسمح عبر OAuth بدخول حساب سبق ربطه بهوية المزوّد؛ لا يُنشئ الخادم حسابًا جديدًا عند تسجيل الدخول بهوية غير معروفة.
- لا يدمج الخادم البريد الذي يطابق حسابًا قديمًا تلقائيًا. سجّل الدخول بالحساب القديم لتجنب الاستيلاء على حساب غير موثق.
- تُخزن مفاتيح Google وApple على الخادم فقط داخل Environment Variables. لا ترسلها في المحادثة.

## توثيق رسمي

- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Apple: إعداد صفحة الويب](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple)
- [Apple: التحقق من المستخدم](https://developer.apple.com/documentation/signinwithapple/verifying-a-user)

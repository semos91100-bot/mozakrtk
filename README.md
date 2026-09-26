# مُذاكرة — نسخة Vercel + Supabase

## 1) قاعدة البيانات
في Supabase افتح SQL Editor وشغّل الملف `SUPABASE.sql` كاملًا. النسخة الحالية تشمل الحسابات، الصلاحيات، المدرسين، الإشعارات، الدعم، الاختبارات، الأسئلة، ونتائج الطلاب.

## 2) متغيرات Vercel
في **Project Settings → Environment Variables** أضف:
- `SUPABASE_URL` = رابط مشروع Supabase
- `SUPABASE_SERVICE_ROLE_KEY` = مفتاح `service_role` من Supabase (سري جدًا، لا يوضع داخل الواجهة)
- `SESSION_SECRET` = قيمة عشوائية طويلة
- `OWNER_EMAIL` و `OWNER_PASSWORD`
- اختياري: `OWNER_2_EMAIL`, `OWNER_2_NAME`, `OWNER_2_PASSWORD`, `OWNER_3_EMAIL`, `OWNER_3_NAME`, `OWNER_3_PASSWORD`
- اختياري: `GEMINI_API_KEY`, `GEMINI_MODEL`

بعد حفظ المتغيرات اختر **Redeploy** لآخر Deployment.

## 3) تسجيل الدخول
الطلاب يدخلون برقم الموبايل + كلمة المرور. الإدارة يمكنها الدخول بالبريد الإلكتروني.

## 4) المدرسين
المدرسون محفوظون داخل `site_content.teachers` ويمكن للإدارة تحديثهم عبر `sitecontentsave`.
مثال عنصر مدرس:
`{"name":"أحمد محمد","subject":"رياضيات","bio":"شرح ومراجعة","contact":"010...","grades":["third"],"branches":["science_math"]}`

## 5) الاختبارات
الطلاب يشاهدون الاختبارات المنشورة لمسارهم فقط، يجيبون عن الأسئلة، والنتيجة تحفظ في `exam_attempts`. الإدارة تستخدم actions الخاصة بالاختبارات لإضافة الاختبار والأسئلة ونشره ومراجعة النتائج.

## 6) اختبار محلي
```bash
node e2e_server.js
node test_login.js
```

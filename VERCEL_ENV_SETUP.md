# إعداد Vercel وSupabase — مُذاكرة

## Environment Variables المطلوبة
أضفها من Vercel → Project → Settings → Environment Variables، وفعّلها للـProduction (ويُفضّل Preview أيضًا أثناء الاختبار):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SESSION_SECRET`
- `OWNER_EMAIL`
- `OWNER_PASSWORD`

اختياري:
- `OWNER_2_EMAIL`, `OWNER_2_NAME`, `OWNER_2_PASSWORD`
- `OWNER_3_EMAIL`, `OWNER_3_NAME`, `OWNER_3_PASSWORD`
- `GEMINI_API_KEY`, `GEMINI_MODEL`

## Supabase
افتح SQL Editor وشغّل `SUPABASE.sql` كاملًا. الملف يحتوي أيضًا على جداول الاختبارات والأسئلة ونتائج المحاولات.

## Redeploy
بعد حفظ المتغيرات:
1. افتح تبويب Deployments في Vercel.
2. اختر آخر Deployment.
3. اختر Redeploy.
4. بعد ظهور Ready افتح الموقع واختبر التسجيل ثم تسجيل الدخول ثم الاختبارات.

## تنبيه أمني
`SUPABASE_SERVICE_ROLE_KEY` مفتاح سري للخادم فقط. لا تضعه داخل `index.html` أو مجلد `assets/` ولا ترسله للطلاب.

## المحتوى التعليمي
`SUPABASE.sql` ينشئ جداول الاختبارات والأسئلة وبنك الأسئلة، ويضيف بيانات تجريبية أولية للطلاب.

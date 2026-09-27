# إعداد Vercel وSupabase — مُذاكرة

## متغيرات بيئة الخادم

من Vercel → Project → Settings → Environment Variables، فعّل الإعدادات للـProduction (وPreview للاختبار):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` — سر للخادم فقط، لا تضعه في ملفات الواجهة.
- `OWNER_EMAIL`
- `OWNER_PASSWORD`

اختياري لكنه موصى به:
- `SESSION_SECRET` — قيمة عشوائية طويلة مستقلة لتوقيع الجلسات. يدعم الإصلاح الجديد اشتقاق مفتاح بديل من مفتاح Supabase عند غيابه، لكن المفتاح المستقل أفضل.
- `OWNER_2_EMAIL`, `OWNER_2_NAME`, `OWNER_2_PASSWORD`
- `OWNER_3_EMAIL`, `OWNER_3_NAME`, `OWNER_3_PASSWORD`
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- بيانات Google/Apple الواردة في `OAUTH-SETUP-AR.md`، إذا رغبت بتفعيل الدخول الاجتماعي.

## Supabase

افتح SQL Editor في **مشروع Supabase نفسه** المرتبط بمتغيرات Vercel وشغّل `SUPABASE.sql` كاملًا. ينشئ الملف الجداول اللازمة للحسابات والمحتوى والدعم والاختبارات.

## النشر والاختبار

بعد أي تغيير في ملفات المشروع أو Environment Variables، أنشئ Deploy جديدًا في Vercel وانتظر حالة Ready. ثم اختبر بالتتابع:

1. افتح `https://mozakrtk.vercel.app/study.html`.
2. أنشئ حسابًا عاديًا جديدًا برقم هاتف غير مستخدم وكلمة مرور.
3. سجّل الخروج ثم ادخل بالهاتف وكلمة المرور نفسها.
4. جرّب Google أو Apple فقط بعد ضبط مفاتيح ذلك المزود وعنوان callback.

تعمل API عبر وظائف Node في `/api/backend`، وOAuth callback عبر `/api/oauth`. لا تعتمد صفحات Vercel على `api/api.php` لأن Vercel لا يشغّل PHP هنا.

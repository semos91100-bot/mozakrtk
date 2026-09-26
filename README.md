# مُذاكرة — نسخة جاهزة لـ Vercel

## النشر
1. ارفع كل الملفات إلى GitHub كما هي.
2. اربط المستودع بـ Vercel.
3. في Vercel > Settings > Environment Variables أضف:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET`
   - `OWNER_EMAIL`
   - `OWNER_PASSWORD`
   - اختياريًا `OWNER_2_EMAIL`, `OWNER_2_NAME`, `OWNER_2_PASSWORD`, `OWNER_3_EMAIL`, `OWNER_3_NAME`, `OWNER_3_PASSWORD`
   - اختياري: `GEMINI_API_KEY`, `GEMINI_MODEL`
4. في Supabase > SQL Editor شغّل `SUPABASE.sql` كاملًا.
5. اعمل Redeploy في Vercel.

## الدخول
الطالب يدخل برقم الموبايل + كلمة المرور.
الإدارة تدخل بالبريد الإلكتروني + كلمة المرور.

لا تضع `SUPABASE_SERVICE_ROLE_KEY` أو أي مفتاح سري في ملفات `assets/` أو `index.html`.

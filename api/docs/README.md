# مُذاكرة — النسخة الكاملة النهائية

هذه النسخة مبنية على الموقع الكامل الأصلي، مع إصلاح نظام تسجيل الدخول والدعم الفني والإشعارات وإضافة نظام الرتب.

## الموجود
- كل صفحات ومحتوى الموقع الأصلي.
- تسجيل الطالب برقم الموبايل + كلمة المرور.
- تسجيل الإدارة بالبريد الإلكتروني + كلمة المرور.
- انتقال مباشر للموقع بعد نجاح تسجيل الدخول بدون ضغطة ثانية.
- نظام رتب:
  - OWNER 👑
  - ADMIN 🔴
  - MODERATOR 🟠
  - SUPPORT 🔵
  - STUDENT 👤
- إدارة الرتب من لوحة الإدارة.
- حماية رتبة OWNER من التغيير بواسطة الرتب الأقل.
- الطالب يفتح تذكرة دعم جديدة ويتابعها.
- التذكرة تظهر للأدمن/المشرف/الدعم من الأجهزة الأخرى عبر Supabase.
- الردود والحالات والأولوية والإشعارات مشتركة بين الأجهزة.
- إرسال إشعار للجميع أو لفريق الدعم أو لطالب برقم الموبايل/الإيميل.
- تشغيل Vercel بدون PHP.

## تشغيل Vercel
اقرأ `SETUP_FINAL.txt` وشغّل `SUPABASE.sql` مرة واحدة في Supabase ثم أضف متغيرات البيئة إلى Vercel.

بيانات OWNER الافتراضية:
- البريد: `semos91100@gmail.com`
- كلمة المرور: تُضبط في متغير البيئة `OWNER_PASSWORD`، ولا تُحفظ في Git.

> لا تضع `SUPABASE_SERVICE_ROLE_KEY` داخل JavaScript أو HTML أو GitHub.


## المراحل والشعب
تمت إضافة اختيار المرحلة والشعبة لحساب الطالب داخل الإعداد الأولي وصفحة «حسابي»:
- أولى ثانوي: عام.
- تانية ثانوي: علمي / أدبي.
- تالتة ثانوي: علمي علوم / علمي رياضة / أدبي.

الاختيار يُحفظ داخل حالة الحساب، ويظهر في رأس الموقع والملف الشخصي ولوحة الإدارة. المحتوى الدراسي الموجود في هذه النسخة يظل كما هو؛ لا يتم اختلاق مناهج أو أسئلة غير مضافة فعليًا للمشروع.

## OWNER control panel
The OWNER account (default `semos91100@gmail.com`) has a protected control panel at `#/admin`.
It can list registered accounts by name/phone/email, change non-owner roles, assign email addresses, and permanently delete non-owner accounts. Account deletion is server-side and cascades through user-owned tickets/notifications via the existing Supabase foreign keys.

The internal `#/admin-chat` is available to OWNER and all staff roles. Students are blocked from the staff chat by the API authorization checks.


## سجل نشاط OWNER
تمت إضافة جدول `audit_logs` وواجهة `audit_logs` التي لا يمكن الوصول إليها إلا للـOWNER.
يسجل: الدخول الناجح، تسجيل الخروج، إنشاء الحساب، تغيير الرتب، تغيير البريد، حذف الحسابات، الإشعارات، التذاكر، وردود التذاكر، ورسائل شات الإدارة.
شغّل `SUPABASE.sql` بعد التحديث لإنشاء جدول السجل.

## الرتبة الافتراضية
أي حساب جديد يبدأ تلقائيًا برتبة `student`، والـOWNER فقط يستطيع رفعه إلى رتبة إدارية.


## تحديث تسجيل الدخول
- الطالب يختار أثناء التسجيل: الاسم + يوزر نيم + رقم الموبايل + الصف + الشعبة + كلمة المرور.
- تسجيل الدخول للطالب متاح برقم الموبايل أو البريد الإلكتروني. البريد الإلكتروني لا يصبح صالحًا للدخول إلا بعد ربطه بالحساب من لوحة OWNER.
- اليوزر نيم فريد، محفوظ على السيرفر، ومتاح لعرضه في لوحة الإدارة.
- يجب تشغيل تحديث SUPABASE.sql مرة واحدة لإضافة عمود username والفهرس الفريد.

### إصلاح التسجيل
تم إصلاح خطأ كان يجعل إنشاء الحساب يرجع "حدث خطأ. جرّب تاني" على Vercel: الـAPI كان يستخدم تعريفًا غير موجود لمراحل وشعب الثانوية (`EDU_GRADES_SERVER`). أضيف التعريف على السيرفر، مع تحويل أخطاء التكرار المعروفة إلى رسائل مفهومة.


## Final hardening pass — 2026-09-24
- Login supports phone, email, and username for student accounts.
- Egyptian phone lookup is backward-compatible with common legacy formats (01…, 20…, +20…).
- Email/username lookup is case-insensitive with exact-first lookup.
- Authentication errors now expose actionable Supabase/Vercel configuration messages.
- Session cookie security adapts to HTTPS on Vercel and remains testable over local HTTP.
- Login/signup forms retain the entered identifier/name/username/phone when validation fails.
- Added an OWNER-only backend health check and a live database-status card in the OWNER panel.
- Client API option merging was hardened so request headers are not accidentally dropped.

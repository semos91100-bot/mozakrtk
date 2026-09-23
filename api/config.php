<?php
// انسخ الملف باسم config.php وضع مفتاح Gemini هنا.
// لا ترفع config.php إلى GitHub أو أي مستودع عام.
return [
  'gemini_api_key' => 'AQ.Ab8RN6KalD_HMR2HTmxhQkflVcd2mLfzU1imxGAU52FKbIer_Q',
  'gemini_model' => 'gemini-3.5-flash',
  // إيميلات المشرفين (بالحروف الصغيرة). أي حساب بإيميل من القايمة دي هيشوف لوحة التحكم تلقائيًا.
  'admin_emails' => [
    'semos91100@gmail.com',
  ],
  // يُستخدم لإنشاء حساب المشرف تلقائيًا إذا لم يكن موجودًا بعد.
  'admin_bootstrap_password_hash' => '$2y$12$B1Lje8LzR4b1O7F.a3pobOHZx5hUtEYKCXdtKKPwAEw9EG/f6WiIW',
];

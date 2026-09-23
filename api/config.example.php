<?php
// إعدادات السيرفر.
// لا تضع أي مفاتيح سرية داخل JavaScript أو مستودع GitHub عام.
return [
  'gemini_api_key' => getenv('GEMINI_API_KEY') ?: '',
  'gemini_model' => 'gemini-3.5-flash',
];

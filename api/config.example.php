<?php
// Copy as config.php if needed. Set credentials through the hosting provider's environment variables.
return [
  'gemini_api_key' => getenv('GEMINI_API_KEY') ?: '',
  'gemini_model' => getenv('GEMINI_MODEL') ?: 'gemini-3.5-flash',
  'admin_code' => getenv('ADMIN_CODE') ?: '',
  'admin_name' => getenv('ADMIN_NAME') ?: 'المشرف'
];

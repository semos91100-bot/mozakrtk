<?php
// Keep credentials in the hosting provider's environment variables, never in source control.
return [
  'gemini_api_key' => getenv('GEMINI_API_KEY') ?: '',
  'gemini_model' => getenv('GEMINI_MODEL') ?: 'gemini-3.5-flash',
  'admin_code' => getenv('01270826363') ?: '',
  'admin_name' => getenv('alton') ?: 'المشرف'
];

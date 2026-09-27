<?php
// Keep credentials in the hosting provider's environment variables, never in source control.
return [
  'gemini_api_key' => getenv('GEMINI_API_KEY') ?: '',
  'gemini_model' => getenv('GEMINI_MODEL') ?: 'gemini-3.5-flash',
  'admin_code' => getenv('ADMIN_CODE') ?: '',
  'admin_name' => getenv('ADMIN_NAME') ?: 'المشرف',
  'oauth_base_url' => getenv('OAUTH_BASE_URL') ?: '',
  'google_client_id' => getenv('GOOGLE_CLIENT_ID') ?: '',
  'google_client_secret' => getenv('GOOGLE_CLIENT_SECRET') ?: '',
  'apple_service_id' => getenv('APPLE_SERVICE_ID') ?: '',
  'apple_team_id' => getenv('APPLE_TEAM_ID') ?: '',
  'apple_key_id' => getenv('APPLE_KEY_ID') ?: '',
  'apple_private_key' => getenv('APPLE_PRIVATE_KEY') ?: ''
];

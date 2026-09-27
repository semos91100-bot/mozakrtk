<?php
// Fixed OAuth callback used by Google (GET) and Apple (form POST).
// The provider and CSRF state are validated in api.php before any account is created.
$_GET['action']='oauth_callback';
require __DIR__.'/api.php';

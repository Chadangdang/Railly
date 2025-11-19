<?php
session_start(); // Start the session

require_once __DIR__ . '/db_connection.php';

// Destroy all session data
session_unset();
session_destroy();

// Redirect to the home page
header('Location: ' . BASE_URL . '/Page/user/Home/home.html');
exit();
?>

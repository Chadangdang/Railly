<?php
session_start(); // Start the session

// Destroy all session data
session_unset();
session_destroy();

// Redirect to the unlogged-in home page
header("Location: ../Unlogin/Unlogin_home.html");
exit();
?>

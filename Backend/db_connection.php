<?php
$servername = "sql110.infinityfree.com";  
$username = "if0_38876323";               
$password = "Chk2oo4o1";                 
$dbname = "if0_38876323_db1";             

$conn = new mysqli($servername, $username, $password, $dbname);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>

<?php
require_once __DIR__ . '/db_connection.php';

$conn = get_db_connection();
echo "✅ Connected successfully to database: " . $conn->host_info;
$conn->close();
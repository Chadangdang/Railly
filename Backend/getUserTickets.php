<?php
// Database connection
$host = "localhost";
$username = "root";
$password = "root";
$dbname = "DB1"; // Replace with your database name

$conn = new mysqli($host, $username, $password, $dbname);

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Check connection
if ($conn->connect_error) {
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $conn->connect_error]);
    exit;
}

// Get username and user_id from GET request
$username = $_GET['username'] ?? null;
$user_id = $_GET['id'] ?? null;

if (!$username || !$user_id) {
    echo json_encode(["status" => "error", "message" => "Missing required parameters: username or user_id."]);
    exit;
}

// Fetch tickets for the user based on user_id
$sql = "SELECT route_id, origin, destination, departure, arrival, price, datee, type 
        FROM confirmed_ticket 
        WHERE username = ? AND user_id = ?";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode(["status" => "error", "message" => "Failed to prepare statement."]);
    exit;
}

$stmt->bind_param("si", $username, $user_id); // Bind username and user_id
$stmt->execute();
$result = $stmt->get_result();

$tickets = [];
while ($row = $result->fetch_assoc()) {
    $tickets[] = $row;
}

$stmt->close();
$conn->close();

if (empty($tickets)) {
    echo json_encode(["status" => "error", "message" => "No tickets found for this user."]);
} else {
    echo json_encode(["status" => "success", "tickets" => $tickets]);
}
?>

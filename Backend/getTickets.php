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

// Get parameters from GET request
$origin = $_GET['origin'] ?? null;
$destination = $_GET['dest'] ?? null;
$datee = $_GET['datee'] ?? null;

if (!$origin || !$destination || !$datee) {
    echo json_encode(["status" => "error", "message" => "Missing required parameters: origin, destination, or date."]);
    exit;
}

// Fetch tickets from the all_train table
$sql = "SELECT route_id, origin, dest, departure, arrival, price, datee, available_ticket
        FROM all_train
        WHERE origin = ? AND dest = ? AND datee = ?";
$stmt = $conn->prepare($sql);

if (!$stmt) {
    echo json_encode(["status" => "error", "message" => "Failed to prepare statement.", "sql_error" => $conn->error]);
    exit;
}

$stmt->bind_param("sss", $origin, $destination, $datee); // Bind parameters
$stmt->execute();
$result = $stmt->get_result();

$tickets = [];
while ($row = $result->fetch_assoc()) {
    $tickets[] = $row;
}

$stmt->close();
$conn->close();

if (empty($tickets)) {
    echo json_encode(["status" => "error", "message" => "No tickets found for the given search criteria."]);
} else {
    echo json_encode($tickets);
}
?>

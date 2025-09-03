<?php
// Database connection
$host = "localhost";
$username = "root";
$password = "root";
$dbname = "DB1"; // Replace with your database name

$conn = new mysqli($host, $username, $password, $dbname);

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Log POST data for debugging
file_put_contents('debug.log', "POST Data: " . json_encode($_POST) . PHP_EOL, FILE_APPEND);

// Check database connection
if ($conn->connect_error) {
    error_log("Database connection failed: " . $conn->connect_error);
    echo json_encode(["status" => "error", "message" => "Database connection failed."]);
    exit;
}

// Retrieve POST parameters
$route_id = $_POST['route_id'] ?? null;
$username = $_POST['username'] ?? null;
$user_id = $_POST['id'] ?? null;
$origin = $_POST['origin'] ?? null;
$destination = $_POST['destination'] ?? null;
$departure = $_POST['departure'] ?? null;
$arrival = $_POST['arrival'] ?? null;
$price = $_POST['price'] ?? null;

$datee = date('Y-m-d'); // Capture the current date
$type = 1; // Assuming 'type' is a constant for now

// Validate required parameters
if (!$route_id || !$username || !$user_id || !$origin || !$destination || !$departure || !$arrival || !$price) {
    error_log("Missing required parameters. POST Data: " . json_encode($_POST));
    echo json_encode(["status" => "error", "message" => "Missing required parameters."]);
    exit;
}

// Clean and sanitize data
$route_id = intval($route_id);
$user_id = intval($user_id);
$price = preg_replace('/[^0-9.]/', '', $price); // Remove "THB" and other non-numeric characters
$price = floatval($price);

// Check ticket availability in `all_train`
$sql_check = "SELECT available_ticket FROM all_train WHERE route_id = ?";
$stmt_check = $conn->prepare($sql_check);
if (!$stmt_check) {
    error_log("SQL Error (Check Availability): " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Database query failed while checking ticket availability."]);
    exit;
}

$stmt_check->bind_param("i", $route_id);
$stmt_check->execute();
$result = $stmt_check->get_result();

if ($result->num_rows === 0) {
    error_log("Route ID not found: " . $route_id);
    echo json_encode(["status" => "error", "message" => "Route ID not found."]);
    exit;
}

$row = $result->fetch_assoc();
$available_ticket = intval($row['available_ticket']);

if ($available_ticket <= 0) {
    error_log("No tickets available for Route ID: " . $route_id);
    echo json_encode(["status" => "error", "message" => "No tickets available for this route."]);
    exit;
}

// Insert booking into `confirmed_ticket`
$sql_insert = "INSERT INTO confirmed_ticket (route_id, username, user_id, origin, destination, departure, arrival, price, datee, type) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
$stmt_insert = $conn->prepare($sql_insert);
if (!$stmt_insert) {
    error_log("SQL Error (Insert Booking): " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Database query failed while confirming booking."]);
    exit;
}

$stmt_insert->bind_param("isissssdsd", $route_id, $username, $user_id, $origin, $destination, $departure, $arrival, $price, $datee, $type);

if (!$stmt_insert->execute()) {
    error_log("Execution Error (Insert Booking): " . $stmt_insert->error);
    echo json_encode(["status" => "error", "message" => "Failed to confirm booking."]);
    exit;
}

// Update available tickets in `all_train`
$sql_update = "UPDATE all_train SET available_ticket = available_ticket - 1 WHERE route_id = ?";
$stmt_update = $conn->prepare($sql_update);
if (!$stmt_update) {
    error_log("SQL Error (Update Tickets): " . $conn->error);
    echo json_encode(["status" => "error", "message" => "Database query failed while updating ticket availability."]);
    exit;
}

$stmt_update->bind_param("i", $route_id);

if (!$stmt_update->execute()) {
    error_log("Execution Error (Update Tickets): " . $stmt_update->error);
    echo json_encode(["status" => "error", "message" => "Failed to update available tickets."]);
    exit;
}

// Return success response
echo json_encode(["status" => "success", "message" => "Booking confirmed successfully."]);

// Close connections
$stmt_check->close();
$stmt_insert->close();
$stmt_update->close();
$conn->close();
?>
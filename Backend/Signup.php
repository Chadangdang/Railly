<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    echo json_encode(['success' => false, 'message' => 'Invalid input data.']);
    exit;
}

$username = isset($payload['username']) ? trim((string) $payload['username']) : '';
$email = isset($payload['email']) ? trim((string) $payload['email']) : '';
$password = isset($payload['password']) ? trim((string) $payload['password']) : '';

if ($username === '' || $email === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

$conn = get_db_connection();

try {
    $checkStmt = $conn->prepare('SELECT id FROM signup WHERE username = ? OR email = ?');
    $checkStmt->bind_param('ss', $username, $email);
    $checkStmt->execute();
    $existing = $checkStmt->get_result();

    if ($existing->num_rows > 0) {
        echo json_encode(['success' => false, 'message' => 'This username or email is already in use. Please try another one.']);
        return;
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    $insertStmt = $conn->prepare('INSERT INTO signup (username, email, pass) VALUES (?, ?, ?)');
    $insertStmt->bind_param('sss', $username, $email, $hashedPassword);
    $insertStmt->execute();

    echo json_encode(['success' => true, 'message' => 'Signup successful!']);
} catch (mysqli_sql_exception $exception) {
    error_log('Signup error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An error occurred while signing up. Please try again.']);
} finally {
    if (isset($checkStmt) && $checkStmt instanceof mysqli_stmt) {
        $checkStmt->close();
    }

    if (isset($insertStmt) && $insertStmt instanceof mysqli_stmt) {
        $insertStmt->close();
    }

    $conn->close();
}

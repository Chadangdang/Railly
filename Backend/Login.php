<?php
declare(strict_types=1);

session_start();
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

$identifier = '';

if (isset($payload['identifier'])) {
    $identifier = trim((string) $payload['identifier']);
} elseif (isset($payload['username'])) {
    $identifier = trim((string) $payload['username']);
}
$password = isset($payload['password']) ? trim((string) $payload['password']) : '';

if ($identifier === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

$conn = get_db_connection();

try {
    $stmt = $conn->prepare('SELECT customer_id, username, email, password_hash FROM customers WHERE username = ? OR email = ?');
    $stmt->bind_param('ss', $identifier, $identifier);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        return;
    }

    $user = $result->fetch_assoc();

    if (!password_verify($password, $user['password_hash'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid password.']);
        return;
    }

    $_SESSION['user_id'] = $user['customer_id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['email'] = $user['email'];

    echo json_encode([
        'success' => true,
        'message' => 'Login successful!',
        'user' => [
            'id' => $user['customer_id'],
            'username' => $user['username'],
            'email' => $user['email']
        ]
    ]);
} catch (mysqli_sql_exception $exception) {
    error_log('Login error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database query failed.']);
} finally {
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}

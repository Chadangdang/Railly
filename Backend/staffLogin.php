<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed.',
    ]);
    exit;
}

require_once __DIR__ . '/db_connection.php';

$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid request payload.',
    ]);
    exit;
}

$identifier = isset($payload['username']) ? trim((string) $payload['username']) : '';
$password = isset($payload['password']) ? (string) $payload['password'] : '';

if ($identifier === '' || $password === '') {
    http_response_code(400);
    echo json_encode([
        'status' => 'error',
        'message' => 'Username and password are required.',
    ]);
    exit;
}

$conn = get_db_connection();

try {
    $stmt = $conn->prepare('SELECT staff_user_id, username, email, password_hash FROM staff_users WHERE (username = ? OR email = ?) AND deleted_at IS NULL LIMIT 1');
    if (!$stmt) {
        throw new mysqli_sql_exception('Failed to prepare statement.');
    }

    $stmt->bind_param('ss', $identifier, $identifier);
    $stmt->execute();

    $result = $stmt->get_result();
    if ($result === false) {
        throw new mysqli_sql_exception('Failed to fetch staff user.');
    }

    if ($result->num_rows === 0) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid username or password.',
        ]);
        return;
    }

    $staff = $result->fetch_assoc();
    if (!$staff || !isset($staff['password_hash'])) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid username or password.',
        ]);
        return;
    }

    if (!password_verify($password, $staff['password_hash'])) {
        http_response_code(401);
        echo json_encode([
            'status' => 'error',
            'message' => 'Invalid username or password.',
        ]);
        return;
    }

    $_SESSION['staff_user_id'] = (int) $staff['staff_user_id'];
    $_SESSION['staff_username'] = $staff['username'];
    $_SESSION['staff_email'] = $staff['email'];

    echo json_encode([
        'status' => 'success',
        'message' => 'Login successful.',
        'staff' => [
            'id' => (int) $staff['staff_user_id'],
            'username' => $staff['username'],
            'email' => $staff['email'],
        ],
    ]);
} catch (mysqli_sql_exception $exception) {
    error_log('staffLogin error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to complete login at this time.',
    ]);
} finally {
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}

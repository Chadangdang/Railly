<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'status' => 'error',
        'message' => 'Method not allowed.',
    ]);
    exit;
}

if (!isset($_SESSION['staff_user_id'])) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'Staff session not found.',
    ]);
    exit;
}

$staffId = (int) $_SESSION['staff_user_id'];
if ($staffId <= 0) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid staff session.',
    ]);
    exit;
}

require_once __DIR__ . '/db_connection.php';

$conn = get_db_connection();

try {
    $stmt = $conn->prepare('SELECT staff_user_id, username, email FROM staff_users WHERE staff_user_id = ? AND deleted_at IS NULL');
    if (!$stmt) {
        throw new mysqli_sql_exception('Failed to prepare statement.');
    }

    $stmt->bind_param('i', $staffId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode([
            'status' => 'error',
            'message' => 'Staff account not found.',
        ]);
        return;
    }

    $staff = $result->fetch_assoc();

    echo json_encode([
        'status' => 'success',
        'staff' => [
            'id' => (int) $staff['staff_user_id'],
            'username' => $staff['username'],
            'email' => $staff['email'],
        ],
    ]);
} catch (mysqli_sql_exception $exception) {
    error_log('staffSession error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Unable to load staff profile at this time.',
    ]);
} finally {
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}

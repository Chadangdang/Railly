<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if ($id === null || $id === false || $id <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'A valid user id is required.']);
    exit;
}

$conn = get_db_connection();

try {
    $stmt = $conn->prepare('SELECT username, email FROM signup WHERE id = ?');
    if (!$stmt) {
        throw new mysqli_sql_exception('Failed to prepare statement.');
    }

    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'User not found.']);
        return;
    }

    $user = $result->fetch_assoc();

    echo json_encode([
        'success' => true,
        'user' => [
            'username' => $user['username'],
            'email' => $user['email']
        ]
    ]);
} catch (mysqli_sql_exception $exception) {
    error_log('getUserProfile error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred while retrieving the user profile.']);
} finally {
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}
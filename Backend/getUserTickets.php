<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

$username = isset($_GET['username']) ? trim((string) $_GET['username']) : '';
$userIdRaw = isset($_GET['id']) ? trim((string) $_GET['id']) : '';

if ($username === '' || $userIdRaw === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing required parameters: username or user_id.']);
    exit;
}

$userId = (int) $userIdRaw;
if ($userId <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid user identifier provided.']);
    exit;
}

$conn = get_db_connection();

try {
    $stmt = $conn->prepare(
        'SELECT route_id, origin, destination, departure, arrival, price, datee, type
         FROM confirmed_ticket
         WHERE username = ? AND user_id = ?'
    );
    $stmt->bind_param('si', $username, $userId);
    $stmt->execute();

    $result = $stmt->get_result();
    $tickets = $result->fetch_all(MYSQLI_ASSOC);

    if (empty($tickets)) {
        echo json_encode(['status' => 'error', 'message' => 'No tickets found for this user.']);
    } else {
        echo json_encode(['status' => 'success', 'tickets' => $tickets]);
    }
} catch (mysqli_sql_exception $exception) {
    error_log('getUserTickets error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to retrieve user tickets.']);
} finally {
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}

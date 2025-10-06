<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$routeId = isset($_POST['route_id']) ? (int) $_POST['route_id'] : 0;
$username = isset($_POST['username']) ? trim((string) $_POST['username']) : '';
$userIdRaw = isset($_POST['id']) ? trim((string) $_POST['id']) : '';
$origin = isset($_POST['origin']) ? trim((string) $_POST['origin']) : '';
$destination = isset($_POST['destination']) ? trim((string) $_POST['destination']) : '';
$departure = isset($_POST['departure']) ? trim((string) $_POST['departure']) : '';
$arrival = isset($_POST['arrival']) ? trim((string) $_POST['arrival']) : '';
$priceRaw = isset($_POST['price']) ? (string) $_POST['price'] : '';
$date = isset($_POST['datee']) ? trim((string) $_POST['datee']) : '';
$type = isset($_POST['type']) ? (int) $_POST['type'] : 1;

$sanitisedPrice = preg_replace('/[^0-9.]/', '', $priceRaw);
$price = $sanitisedPrice !== '' ? number_format((float) $sanitisedPrice, 2, '.', '') : '';
$date = $date !== '' ? $date : date('Y-m-d');

if (
    $routeId <= 0 ||
    $username === '' ||
    $userIdRaw === '' ||
    $origin === '' ||
    $destination === '' ||
    $departure === '' ||
    $arrival === '' ||
    $price === ''
) {
    echo json_encode(['status' => 'error', 'message' => 'Missing required parameters.']);
    exit;
}

$userId = (int) $userIdRaw;
if ($userId <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid user information.']);
    exit;
}

$conn = get_db_connection();

try {
    $conn->begin_transaction();

    $checkStmt = $conn->prepare('SELECT available_ticket FROM all_train WHERE route_id = ? FOR UPDATE');
    $checkStmt->bind_param('i', $routeId);
    $checkStmt->execute();

    $routeResult = $checkStmt->get_result();
    if ($routeResult->num_rows === 0) {
        $conn->rollback();
        echo json_encode(['status' => 'error', 'message' => 'Route ID not found.']);
        return;
    }

    $availableTicket = (int) $routeResult->fetch_assoc()['available_ticket'];
    if ($availableTicket <= 0) {
        $conn->rollback();
        echo json_encode(['status' => 'error', 'message' => 'No tickets available for this route.']);
        return;
    }

    $insertStmt = $conn->prepare(
        'INSERT INTO confirmed_ticket (route_id, username, user_id, origin, destination, departure, arrival, price, datee, type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertStmt->bind_param(
        'isissssssi',
        $routeId,
        $username,
        $userId,
        $origin,
        $destination,
        $departure,
        $arrival,
        $price,
        $date,
        $type
    );
    $insertStmt->execute();

    $updateStmt = $conn->prepare('UPDATE all_train SET available_ticket = available_ticket - 1 WHERE route_id = ?');
    $updateStmt->bind_param('i', $routeId);
    $updateStmt->execute();

    $conn->commit();
    echo json_encode(['status' => 'success', 'message' => 'Booking confirmed successfully.']);
} catch (mysqli_sql_exception $exception) {
    $conn->rollback();
    error_log('confirm error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to confirm booking.']);
} finally {
    if (isset($checkStmt) && $checkStmt instanceof mysqli_stmt) {
        $checkStmt->close();
    }

    if (isset($insertStmt) && $insertStmt instanceof mysqli_stmt) {
        $insertStmt->close();
    }

    if (isset($updateStmt) && $updateStmt instanceof mysqli_stmt) {
        $updateStmt->close();
    }

    $conn->close();
}

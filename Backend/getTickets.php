<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

$origin = isset($_GET['origin']) ? trim((string) $_GET['origin']) : '';
$destination = isset($_GET['dest']) ? trim((string) $_GET['dest']) : '';
$date = isset($_GET['datee']) ? trim((string) $_GET['datee']) : '';

if ($origin === '' || $destination === '' || $date === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing required parameters: origin, destination, or date.']);
    exit;
}

$conn = get_db_connection();

try {
    $stmt = $conn->prepare(
        'SELECT route_id, origin, dest, departure, arrival, price, datee, available_ticket
         FROM all_train
         WHERE origin = ? AND dest = ? AND datee = ?'
    );
    $stmt->bind_param('sss', $origin, $destination, $date);
    $stmt->execute();

    $result = $stmt->get_result();
    $tickets = $result->fetch_all(MYSQLI_ASSOC);

    if (empty($tickets)) {
        echo json_encode(['status' => 'error', 'message' => 'No tickets found for the given search criteria.']);
    } else {
        echo json_encode($tickets);
    }
} catch (mysqli_sql_exception $exception) {
    error_log('getTickets error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to retrieve tickets.']);
} finally {
    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}

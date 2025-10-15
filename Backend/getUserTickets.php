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
    $userStmt = $conn->prepare('SELECT username FROM user WHERE user_id = ?');
    $userStmt->bind_param('i', $userId);
    $userStmt->execute();

    $userResult = $userStmt->get_result();
    if ($userResult->num_rows === 0) {
        echo json_encode(['status' => 'error', 'message' => 'User not found.']);
        return;
    }

    $dbUser = $userResult->fetch_assoc();
    if (strcasecmp($dbUser['username'], $username) !== 0) {
        echo json_encode(['status' => 'error', 'message' => 'User information does not match.']);
        return;
    }

    $status = 'PAID';

    $stmt = $conn->prepare(
        'SELECT
            pt.ticket_id,
            pt.quantity,
            pt.status,
            pt.created_at,
            s.service_id,
            s.service_date,
            r.origin,
            r.dest,
            r.depart_time,
            r.arrival_time,
            r.price_thb
         FROM paid_ticket AS pt
         INNER JOIN service AS s ON s.service_id = pt.service_id
         INNER JOIN route AS r ON r.route_id = s.route_id
         WHERE pt.user_id = ? AND pt.status = ?
         ORDER BY s.service_date, r.depart_time'
    );
    $stmt->bind_param('is', $userId, $status);
    $stmt->execute();

    $result = $stmt->get_result();
    $tickets = [];

    while ($row = $result->fetch_assoc()) {
        $tickets[] = [
            'ticket_id' => (int) $row['ticket_id'],
            'route_id' => (int) $row['service_id'],
            'origin' => $row['origin'],
            'destination' => $row['dest'],
            'departure' => formatTimeForOutput($row['depart_time']),
            'arrival' => formatTimeForOutput($row['arrival_time']),
            'price' => formatPriceForOutput($row['price_thb']),
            'datee' => $row['service_date'],
            'quantity' => (int) $row['quantity'],
            'status' => $row['status'],
            'created_at' => $row['created_at'],
        ];
    }

    echo json_encode(['status' => 'success', 'tickets' => $tickets]);
} catch (mysqli_sql_exception $exception) {
    error_log('getUserTickets error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to retrieve user tickets.']);
} finally {
    if (isset($userStmt) && $userStmt instanceof mysqli_stmt) {
        $userStmt->close();
    }

    if (isset($stmt) && $stmt instanceof mysqli_stmt) {
        $stmt->close();
    }

    $conn->close();
}

function formatTimeForOutput(string $timeValue): string
{
    $timestamp = strtotime($timeValue);

    if ($timestamp === false) {
        return $timeValue;
    }

    return date('H:i', $timestamp);
}

function formatPriceForOutput(string $price): string
{
    if (!is_numeric($price)) {
        return $price;
    }

    return number_format((float) $price, 2, '.', '');
} 

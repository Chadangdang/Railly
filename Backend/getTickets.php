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
        'SELECT
            s.service_id AS service_id,
            r.origin,
            r.dest,
            r.depart_time,
            r.arrival_time,
            r.price_thb,
            s.service_date,
            s.available_ticket
         FROM service AS s
         INNER JOIN route AS r ON r.route_id = s.route_id
         WHERE r.origin = ? AND r.dest = ? AND s.service_date = ?'
    );
    $stmt->bind_param('sss', $origin, $destination, $date);
    $stmt->execute();

    $result = $stmt->get_result();
    $tickets = [];

    while ($row = $result->fetch_assoc()) {
        $tickets[] = [
            'route_id' => (int) $row['service_id'],
            'origin' => $row['origin'],
            'dest' => $row['dest'],
            'departure' => formatTimeForOutput($row['depart_time']),
            'arrival' => formatTimeForOutput($row['arrival_time']),
            'price' => formatPriceForOutput($row['price_thb']),
            'datee' => $row['service_date'],
            'available_ticket' => (int) $row['available_ticket'],
        ];
    }

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
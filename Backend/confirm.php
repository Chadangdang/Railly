<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$serviceId = isset($_POST['route_id']) ? (int) $_POST['route_id'] : 0;
$username = isset($_POST['username']) ? trim((string) $_POST['username']) : '';
$userIdRaw = isset($_POST['id']) ? trim((string) $_POST['id']) : '';
$quantityRaw = isset($_POST['type']) ? (int) $_POST['type'] : 1;
$quantity = $quantityRaw > 0 ? $quantityRaw : 1;

if ($serviceId <= 0 || $username === '' || $userIdRaw === '') {
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

    $transactionStarted = false;

    try {
        $conn->begin_transaction();
        $transactionStarted = true;

        $serviceStmt = $conn->prepare(
            'SELECT
                s.available_ticket,
                s.service_date,
                r.origin,
                r.dest,
                r.depart_time,
                r.arrival_time,
                r.price_thb
             FROM service AS s
             INNER JOIN route AS r ON r.route_id = s.route_id
             WHERE s.service_id = ?
             FOR UPDATE'
        );
        $serviceStmt->bind_param('i', $serviceId);
        $serviceStmt->execute();

        $serviceResult = $serviceStmt->get_result();
        if ($serviceResult->num_rows === 0) {
            $conn->rollback();
            echo json_encode(['status' => 'error', 'message' => 'Service not found for the provided route.']);
            return;
        }

        $service = $serviceResult->fetch_assoc();
        $availableTickets = (int) $service['available_ticket'];

        if ($availableTickets < $quantity) {
            $conn->rollback();
            echo json_encode(['status' => 'error', 'message' => 'No tickets available for this service.']);
            return;
        }

        $status = 'PAID';

        $insertStmt = $conn->prepare(
            'INSERT INTO paid_ticket (user_id, service_id, quantity, status) VALUES (?, ?, ?, ?)'
        );
        $insertStmt->bind_param('iiis', $userId, $serviceId, $quantity, $status);
        $insertStmt->execute();

        $ticketId = $conn->insert_id;

        $updateStmt = $conn->prepare('UPDATE service SET available_ticket = available_ticket - ? WHERE service_id = ?');
        $updateStmt->bind_param('ii', $quantity, $serviceId);
        $updateStmt->execute();

        $conn->commit();
        $transactionStarted = false;

        $remainingTickets = $availableTickets - $quantity;

        echo json_encode([
            'status' => 'success',
            'message' => 'Booking confirmed successfully.',
            'ticket' => [
                'ticket_id' => (int) $ticketId,
                'route_id' => $serviceId,
                'origin' => $service['origin'],
                'destination' => $service['dest'],
                'departure' => formatTimeForOutput($service['depart_time']),
                'arrival' => formatTimeForOutput($service['arrival_time']),
                'datee' => $service['service_date'],
                'price' => formatPriceForOutput($service['price_thb']),
                'quantity' => $quantity,
                'status' => $status,
            ],
            'remaining_tickets' => $remainingTickets,
        ]);
    } catch (mysqli_sql_exception $exception) {
        if ($transactionStarted) {
            $conn->rollback();
        }

        throw $exception;
    }
} catch (mysqli_sql_exception $exception) {
    error_log('confirm error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to confirm booking.']);
} finally {
    if (isset($userStmt) && $userStmt instanceof mysqli_stmt) {
        $userStmt->close();
    }

    if (isset($serviceStmt) && $serviceStmt instanceof mysqli_stmt) {
        $serviceStmt->close();
    }

    if (isset($insertStmt) && $insertStmt instanceof mysqli_stmt) {
        $insertStmt->close();
    }

    if (isset($updateStmt) && $updateStmt instanceof mysqli_stmt) {
        $updateStmt->close();
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

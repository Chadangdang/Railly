<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';
require_once __DIR__ . '/schema_util.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$serviceId = isset($_POST['route_id']) ? (int) $_POST['route_id'] : 0;
$username = isset($_POST['username']) ? trim((string) $_POST['username']) : '';
$userIdRaw = isset($_POST['id']) ? trim((string) $_POST['id']) : '';

$quantityInput = $_POST['quantity'] ?? $_POST['type'] ?? 1;
$quantity = (int) $quantityInput;
if ($quantity <= 0) {
    $quantity = 1;
}

$unitPrice = null;
if (isset($_POST['unit_price']) && is_numeric($_POST['unit_price'])) {
    $unitPrice = (float) $_POST['unit_price'];
}

$totalAmount = null;
if (isset($_POST['price']) && is_numeric($_POST['price'])) {
    $totalAmount = (float) $_POST['price'];
}

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
    $schema = determineBookingSchema($conn);

    if ($schema['variant'] === 'relational') {
        $response = handleRelationalBooking(
            $conn,
            $schema,
            [
                'service_id' => $serviceId,
                'user_id' => $userId,
                'username' => $username,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total_amount' => $totalAmount,
            ]
        );
    } else {
        $response = handleLegacyBooking(
            $conn,
            $schema,
            [
                'service_id' => $serviceId,
                'user_id' => $userId,
                'username' => $username,
                'quantity' => $quantity,
            ]
        );
    }

    echo json_encode($response);
} catch (InvalidArgumentException $exception) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('confirm error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to confirm booking.']);
} finally {
    $conn->close();
}

function handleRelationalBooking(mysqli $conn, array $schema, array $input): array
{
    $userRow = fetchValidatedUser(
        $conn,
        $schema['user_table'],
        $schema['user_id_column'],
        $schema['user_name_column'],
        $input['user_id'],
        $input['username']
    );

    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $serviceRow = fetchRelationalServiceForUpdate($conn, $schema, $input['service_id']);

        $availableTickets = $schema['service_available_column'] !== null
            ? max((int) $serviceRow['available_count'], 0)
            : max((int) $serviceRow['capacity'] - (int) $serviceRow['sold_count'], 0);

        if ($availableTickets < $input['quantity']) {
            throw new InvalidArgumentException('No tickets available for this service.');
        }

        $unitPrice = determineUnitPrice($serviceRow, $input['unit_price'], $input['total_amount'], $input['quantity']);
        $totalAmount = round($unitPrice * $input['quantity'], 2);

        $orderId = insertOrderRecord(
            $conn,
            $schema,
            $input['user_id'],
            $input['quantity'],
            $totalAmount
        );

        $firstTicketId = insertTicketRows(
            $conn,
            $schema,
            $orderId,
            $input['user_id'],
            $input['service_id'],
            $unitPrice,
            $input['quantity']
        );

        $remainingTickets = updateRelationalAvailability(
            $conn,
            $schema,
            $input['service_id'],
            $input['quantity'],
            $availableTickets,
            (int) $serviceRow['capacity'],
            (int) $serviceRow['sold_count']
        );

        $conn->commit();
        $transactionStarted = false;

        return buildSuccessResponse(
            $firstTicketId,
            $input['service_id'],
            $input['quantity'],
            $unitPrice,
            $serviceRow['origin_name'],
            $serviceRow['dest_name'],
            $serviceRow['depart_time'],
            $serviceRow['arrival_time'],
            $serviceRow['service_date'],
            $remainingTickets,
            $orderId,
            $totalAmount
        );
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function handleLegacyBooking(mysqli $conn, array $schema, array $input): array
{
    fetchValidatedUser(
        $conn,
        $schema['user_table'],
        $schema['user_id_column'],
        $schema['user_name_column'],
        $input['user_id'],
        $input['username']
    );

    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $serviceRow = fetchLegacyServiceForUpdate($conn, $schema, $input['service_id']);

        $availableTickets = max((int) $serviceRow['available_ticket'], 0);
        if ($availableTickets < $input['quantity']) {
            throw new InvalidArgumentException('No tickets available for this service.');
        }

        $status = 'PAID';

        $ticketSql = sprintf(
            'INSERT INTO %s (%s, %s, %s, %s) VALUES (?, ?, ?, ?)',
            quoteIdentifier($schema['ticket_table']),
            quoteIdentifier($schema['ticket_user_column']),
            quoteIdentifier($schema['ticket_service_column']),
            quoteIdentifier($schema['ticket_quantity_column']),
            quoteIdentifier($schema['ticket_status_column'])
        );
        $ticketStmt = $conn->prepare($ticketSql);
        $ticketStmt->bind_param('iiis', $input['user_id'], $input['service_id'], $input['quantity'], $status);
        $ticketStmt->execute();
        $ticketId = $conn->insert_id;
        $ticketStmt->close();

        $updateSql = sprintf(
            'UPDATE %s SET %s = %s - ? WHERE %s = ?',
            quoteIdentifier($schema['service_table']),
            quoteIdentifier($schema['service_available_column']),
            quoteIdentifier($schema['service_available_column']),
            quoteIdentifier($schema['service_id_column'])
        );
        $updateStmt = $conn->prepare($updateSql);
        $updateStmt->bind_param('ii', $input['quantity'], $input['service_id']);
        $updateStmt->execute();
        $updateStmt->close();

        $conn->commit();
        $transactionStarted = false;

        return [
            'status' => 'success',
            'message' => 'Booking confirmed successfully.',
            'ticket' => [
                'ticket_id' => (int) $ticketId,
                'route_id' => $input['service_id'],
                'origin' => $serviceRow['origin'],
                'destination' => $serviceRow['dest'],
                'departure' => formatTimeForOutput($serviceRow['depart_time']),
                'arrival' => formatTimeForOutput($serviceRow['arrival_time']),
                'datee' => $serviceRow['service_date'],
                'price' => formatPriceForOutput((string) $serviceRow['price_thb']),
                'quantity' => $input['quantity'],
                'status' => $status,
            ],
            'remaining_tickets' => $availableTickets - $input['quantity'],
        ];
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function fetchRelationalServiceForUpdate(mysqli $conn, array $schema, int $serviceId): array
{
    $selectParts = [
        sprintf('%s AS service_id', qualifyColumn('s', $schema['service_id_column'])),
        sprintf('%s AS capacity', qualifyColumn('s', $schema['service_capacity_column'])),
        sprintf('%s AS depart_time', qualifyColumn('s', $schema['service_depart_column'])),
        sprintf('%s AS arrival_time', qualifyColumn('s', $schema['service_arrival_column'])),
        sprintf('DATE(%s) AS service_date', qualifyColumn('s', $schema['service_depart_column'])),
        sprintf('%s AS route_id', qualifyColumn('s', $schema['service_route_column'])),
        sprintf('%s AS origin_name', qualifyColumn('origin', $schema['station_name_column'])),
        sprintf('%s AS dest_name', qualifyColumn('dest', $schema['station_name_column']))
    ];

    if ($schema['service_available_column'] !== null) {
        $selectParts[] = sprintf('%s AS available_count', qualifyColumn('s', $schema['service_available_column']));
    } else {
        $selectParts[] = 'NULL AS available_count';
    }

    if ($schema['station_code_column'] !== null) {
        $selectParts[] = sprintf('%s AS origin_code', qualifyColumn('origin', $schema['station_code_column']));
        $selectParts[] = sprintf('%s AS dest_code', qualifyColumn('dest', $schema['station_code_column']));
    } else {
        $selectParts[] = 'NULL AS origin_code';
        $selectParts[] = 'NULL AS dest_code';
    }

    if ($schema['route_price_column'] !== null) {
        $selectParts[] = sprintf('%s AS base_price', qualifyColumn('r', $schema['route_price_column']));
    } else {
        $selectParts[] = 'NULL AS base_price';
    }

    $selectParts[] = 'COALESCE(sold.sold_count, 0) AS sold_count';

    $soldJoin = sprintf(
        "LEFT JOIN (SELECT %s AS service_id, COUNT(*) AS sold_count FROM %s WHERE %s IN ('PAID','USED') GROUP BY %s) AS sold ON sold.service_id = %s",
        quoteIdentifier($schema['ticket_service_fk_column']),
        quoteIdentifier($schema['tickets_table']),
        quoteIdentifier($schema['ticket_status_column']),
        quoteIdentifier($schema['ticket_service_fk_column']),
        qualifyColumn('s', $schema['service_id_column'])
    );

    $query = sprintf(
        'SELECT %s FROM %s AS s ' .
        'INNER JOIN %s AS r ON %s = %s ' .
        'INNER JOIN %s AS origin ON %s = %s ' .
        'INNER JOIN %s AS dest ON %s = %s ' .
        '%s WHERE %s = ? FOR UPDATE',
        implode(', ', $selectParts),
        quoteIdentifier($schema['service_table']),
        quoteIdentifier($schema['route_table']),
        qualifyColumn('r', $schema['route_pk_column']),
        qualifyColumn('s', $schema['service_route_column']),
        quoteIdentifier($schema['station_table']),
        qualifyColumn('origin', $schema['station_id_column']),
        qualifyColumn('r', $schema['origin_station_column']),
        quoteIdentifier($schema['station_table']),
        qualifyColumn('dest', $schema['station_id_column']),
        qualifyColumn('r', $schema['dest_station_column']),
        $soldJoin,
        qualifyColumn('s', $schema['service_id_column'])
    );

    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $serviceId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Service not found for the provided route.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    $row['origin_name'] = buildStationLabel($row['origin_name'], $row['origin_code'] ?? null);
    $row['dest_name'] = buildStationLabel($row['dest_name'], $row['dest_code'] ?? null);

    return $row;
}

function fetchLegacyServiceForUpdate(mysqli $conn, array $schema, int $serviceId): array
{
    $query = sprintf(
        'SELECT %s AS available_ticket, %s AS service_date, %s AS origin, %s AS dest, %s AS depart_time, %s AS arrival_time, %s AS price_thb '
        . 'FROM %s AS s '
        . 'INNER JOIN %s AS r ON %s = %s '
        . 'WHERE %s = ? FOR UPDATE',
        qualifyColumn('s', $schema['service_available_column']),
        qualifyColumn('s', $schema['service_date_column']),
        qualifyColumn('r', $schema['route_origin_column']),
        qualifyColumn('r', $schema['route_dest_column']),
        qualifyColumn('r', $schema['route_depart_column']),
        qualifyColumn('r', $schema['route_arrival_column']),
        $schema['route_price_column'] !== null
            ? qualifyColumn('r', $schema['route_price_column'])
            : "'0'",
        quoteIdentifier($schema['service_table']),
        quoteIdentifier($schema['route_table']),
        qualifyColumn('r', $schema['route_pk_column']),
        qualifyColumn('s', $schema['service_route_column']),
        qualifyColumn('s', $schema['service_id_column'])
    );

    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $serviceId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Service not found for the provided route.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    return $row;
}

function determineUnitPrice(array $serviceRow, ?float $unitPrice, ?float $totalAmount, int $quantity): float
{
    if ($unitPrice !== null && $unitPrice > 0) {
        return round($unitPrice, 2);
    }

    if (isset($serviceRow['base_price']) && is_numeric($serviceRow['base_price'])) {
        return round((float) $serviceRow['base_price'], 2);
    }

    if ($totalAmount !== null && $quantity > 0) {
        return round($totalAmount / $quantity, 2);
    }

    throw new InvalidArgumentException('Unable to determine ticket price.');
}

function insertOrderRecord(
    mysqli $conn,
    array $schema,
    int $customerId,
    int $totalUnit,
    float $totalAmount
): int {
    $columns = [
        quoteIdentifier($schema['orders_customer_column'])
    ];
    $placeholders = ['?'];
    $types = 'i';
    $values = [$customerId];

    if ($schema['orders_total_unit_column'] !== null) {
        $columns[] = quoteIdentifier($schema['orders_total_unit_column']);
        $placeholders[] = '?';
        $types .= 'i';
        $values[] = $totalUnit;
    }

    if ($schema['orders_total_amount_column'] !== null) {
        $columns[] = quoteIdentifier($schema['orders_total_amount_column']);
        $placeholders[] = '?';
        $types .= 'd';
        $values[] = $totalAmount;
    }

    $paidAtExpression = '';
    if ($schema['orders_paid_at_column'] !== null) {
        $columns[] = quoteIdentifier($schema['orders_paid_at_column']);
        $paidAtExpression = ', NOW()';
    }

    $sql = sprintf(
        'INSERT INTO %s (%s) VALUES (%s%s)',
        quoteIdentifier($schema['orders_table']),
        implode(', ', $columns),
        implode(', ', $placeholders),
        $paidAtExpression !== '' ? $paidAtExpression : ''
    );

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    $stmt->execute();
    $orderId = $conn->insert_id;
    $stmt->close();

    return (int) $orderId;
}

function insertTicketRows(
    mysqli $conn,
    array $schema,
    int $orderId,
    int $customerId,
    int $serviceId,
    float $unitPrice,
    int $quantity
): int {
    $sql = sprintf(
        'INSERT INTO %s (%s, %s, %s, %s, %s) VALUES (?, ?, ?, ?, ?)',
        quoteIdentifier($schema['tickets_table']),
        quoteIdentifier($schema['ticket_order_fk_column']),
        quoteIdentifier($schema['ticket_customer_fk_column']),
        quoteIdentifier($schema['ticket_service_fk_column']),
        quoteIdentifier($schema['ticket_unit_price_column']),
        quoteIdentifier($schema['ticket_status_column'])
    );

    $stmt = $conn->prepare($sql);
    $status = 'PAID';
    $types = 'iiids';
    $stmt->bind_param($types, $orderId, $customerId, $serviceId, $unitPrice, $status);
    $firstTicketId = null;

    for ($i = 0; $i < $quantity; $i++) {
        $stmt->execute();

        if ($firstTicketId === null) {
            $firstTicketId = (int) $conn->insert_id;
        }
    }

    $stmt->close();

    return $firstTicketId ?? 0;
}

function updateRelationalAvailability(
    mysqli $conn,
    array $schema,
    int $serviceId,
    int $quantity,
    int $currentAvailable,
    int $capacity,
    int $soldCount
): int {
    if ($schema['service_available_column'] !== null) {
        $newAvailable = max($currentAvailable - $quantity, 0);
        $sql = sprintf(
            'UPDATE %s SET %s = ? WHERE %s = ?',
            quoteIdentifier($schema['service_table']),
            quoteIdentifier($schema['service_available_column']),
            quoteIdentifier($schema['service_id_column'])
        );

        $stmt = $conn->prepare($sql);
        $stmt->bind_param('ii', $newAvailable, $serviceId);
        $stmt->execute();
        $stmt->close();

        return $newAvailable;
    }

    return max($capacity - ($soldCount + $quantity), 0);
}

function buildSuccessResponse(
    int $ticketId,
    int $serviceId,
    int $quantity,
    float $unitPrice,
    string $origin,
    string $destination,
    string $departTime,
    string $arrivalTime,
    string $serviceDate,
    int $remaining,
    int $orderId,
    float $totalAmount
): array {
    return [
        'status' => 'success',
        'message' => 'Booking confirmed successfully.',
        'ticket' => [
            'ticket_id' => $ticketId,
            'route_id' => $serviceId,
            'origin' => $origin,
            'destination' => $destination,
            'departure' => formatTimeForOutput($departTime),
            'arrival' => formatTimeForOutput($arrivalTime),
            'datee' => $serviceDate,
            'price' => formatPriceForOutput(number_format($unitPrice, 2, '.', '')),
            'quantity' => $quantity,
            'status' => 'PAID',
        ],
        'remaining_tickets' => $remaining,
        'order' => [
            'order_id' => $orderId,
            'total_unit' => $quantity,
            'total_amount' => formatPriceForOutput(number_format($totalAmount, 2, '.', '')),
        ],
    ];
}


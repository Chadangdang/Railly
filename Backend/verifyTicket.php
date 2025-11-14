<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';
require_once __DIR__ . '/schema_util.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'GET' && $method !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed.']);
    exit;
}

$input = $method === 'POST' ? $_POST : $_GET;
$ticketIdRaw = isset($input['ticket_id']) ? trim((string) $input['ticket_id']) : '';
$userIdRaw = isset($input['user_id']) ? trim((string) $input['user_id']) : '';

if ($ticketIdRaw === '' || $userIdRaw === '') {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Missing ticket or user identifier.']);
    exit;
}

$ticketId = (int) $ticketIdRaw;
$userId = (int) $userIdRaw;

if ($ticketId <= 0 || $userId <= 0) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid ticket or user identifier.']);
    exit;
}

$conn = get_db_connection();

try {
    $schema = determineBookingSchema($conn);

    if ($method === 'POST') {
        $ticket = markTicketAsUsed($conn, $schema, $ticketId, $userId);
        $ticket['message'] = buildStatusMessage($ticket['status']);

        echo json_encode([
            'status' => 'success',
            'ticket' => $ticket,
            'message' => 'Ticket marked as used successfully.',
        ]);
        return;
    }

    $ticket = fetchTicketForVerification($conn, $schema, $ticketId, $userId);
    $ticket['message'] = buildStatusMessage($ticket['status']);

    echo json_encode([
        'status' => 'success',
        'ticket' => $ticket,
        'message' => $ticket['message'],
    ]);
} catch (InvalidArgumentException $exception) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('verifyTicket error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to verify the ticket at this time.']);
} finally {
    $conn->close();
}

function buildStatusMessage(string $status): string
{
    $normalized = strtoupper(trim($status));

    switch ($normalized) {
        case 'PAID':
            return 'Ticket is valid and ready to board.';
        case 'USED':
            return 'Ticket has already been marked as used.';
        case 'CANCELLED':
            return 'Ticket was cancelled and cannot be accepted.';
        case 'EXPIRED':
            return 'Ticket has expired and is no longer valid.';
        default:
            return 'Ticket status could not be determined. Please double check with the passenger.';
    }
}

function fetchTicketForVerification(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    if ($schema['variant'] === 'relational') {
        return fetchRelationalTicketForVerification($conn, $schema, $ticketId, $userId);
    }

    return fetchLegacyTicketForVerification($conn, $schema, $ticketId, $userId);
}

function markTicketAsUsed(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    if ($schema['variant'] === 'relational') {
        return markRelationalTicketAsUsed($conn, $schema, $ticketId, $userId);
    }

    return markLegacyTicketAsUsed($conn, $schema, $ticketId, $userId);
}

function fetchRelationalTicketForVerification(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    $columns = [
        qualifyColumn('t', $schema['ticket_id_column']) . ' AS ticket_id',
        qualifyColumn('t', $schema['ticket_status_column']) . ' AS status',
        qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' AS customer_id',
        qualifyColumn('u', $schema['user_name_column']) . ' AS username',
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        'DATE(' . qualifyColumn('s', $schema['service_depart_column']) . ') AS service_date',
        'TIME(' . qualifyColumn('s', $schema['service_depart_column']) . ') AS depart_time',
        'TIME(' . qualifyColumn('s', $schema['service_arrival_column']) . ') AS arrival_time',
        qualifyColumn('origin', $schema['station_name_column']) . ' AS origin_name',
        $schema['station_code_column'] !== null
            ? qualifyColumn('origin', $schema['station_code_column']) . ' AS origin_code'
            : 'NULL AS origin_code',
        qualifyColumn('dest', $schema['station_name_column']) . ' AS dest_name',
        $schema['station_code_column'] !== null
            ? qualifyColumn('dest', $schema['station_code_column']) . ' AS dest_code'
            : 'NULL AS dest_code',
    ];

    if ($schema['ticket_unit_price_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_unit_price_column']) . ' AS unit_price';
    } else {
        $columns[] = 'NULL AS unit_price';
    }

    if ($schema['route_price_column'] !== null) {
        $columns[] = qualifyColumn('r', $schema['route_price_column']) . ' AS base_price';
    } else {
        $columns[] = 'NULL AS base_price';
    }

    if ($schema['ticket_issued_at_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_issued_at_column']) . ' AS issued_at';
    } else {
        $columns[] = 'NULL AS issued_at';
    }

    if ($schema['ticket_used_at_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_used_at_column']) . ' AS used_at';
    } else {
        $columns[] = 'NULL AS used_at';
    }

    if ($schema['ticket_cancelled_at_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_cancelled_at_column']) . ' AS cancelled_at';
    } else {
        $columns[] = 'NULL AS cancelled_at';
    }

    $query = 'SELECT ' . implode(', ', $columns)
        . ' FROM ' . quoteIdentifier($schema['tickets_table']) . ' AS t '
        . 'INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('s', $schema['service_id_column']) . ' = ' . qualifyColumn('t', $schema['ticket_service_fk_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['service_route_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS origin ON '
        . qualifyColumn('origin', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['origin_station_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS dest ON '
        . qualifyColumn('dest', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['dest_station_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['user_table']) . ' AS u ON '
        . qualifyColumn('u', $schema['user_id_column']) . ' = ' . qualifyColumn('t', $schema['ticket_customer_fk_column'])
        . ' WHERE ' . qualifyColumn('t', $schema['ticket_id_column']) . ' = ?'
        . ' AND ' . qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' = ?';

    if ($schema['ticket_deleted_column'] !== null) {
        $query .= ' AND ' . qualifyColumn('t', $schema['ticket_deleted_column']) . ' IS NULL';
    }

    $stmt = $conn->prepare($query);
    $stmt->bind_param('ii', $ticketId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Ticket not found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    $origin = buildStationLabel($row['origin_name'], $row['origin_code']);
    $destination = buildStationLabel($row['dest_name'], $row['dest_code']);

    $price = $row['unit_price'];
    if ($price === null || $price === '') {
        $price = $row['base_price'];
    }

    return [
        'ticket_id' => (int) $row['ticket_id'],
        'user_id' => (int) $row['customer_id'],
        'username' => $row['username'] ?? null,
        'status' => (string) $row['status'],
        'service_id' => (int) $row['service_id'],
        'date' => $row['service_date'],
        'departure_time' => formatTimeForOutput($row['depart_time']),
        'arrival_time' => formatTimeForOutput($row['arrival_time']),
        'origin' => $origin,
        'destination' => $destination,
        'quantity' => 1,
        'price' => $price !== null ? formatPriceForOutput((string) $price) : '0.00',
        'issued_at' => $row['issued_at'] ?? null,
        'used_at' => $row['used_at'] ?? null,
        'cancelled_at' => $row['cancelled_at'] ?? null,
    ];
}

function fetchLegacyTicketForVerification(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    $columns = [
        qualifyColumn('pt', $schema['ticket_id_column']) . ' AS ticket_id',
        qualifyColumn('pt', $schema['ticket_status_column']) . ' AS status',
        qualifyColumn('pt', $schema['ticket_user_column']) . ' AS customer_id',
        qualifyColumn('pt', $schema['ticket_quantity_column']) . ' AS quantity',
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        qualifyColumn('s', $schema['service_date_column']) . ' AS service_date',
        qualifyColumn('r', $schema['route_depart_column']) . ' AS depart_time',
        qualifyColumn('r', $schema['route_arrival_column']) . ' AS arrival_time',
        qualifyColumn('r', $schema['route_origin_column']) . ' AS origin_name',
        qualifyColumn('r', $schema['route_dest_column']) . ' AS dest_name',
        qualifyColumn('u', $schema['user_name_column']) . ' AS username',
    ];

    if ($schema['route_price_column'] !== null) {
        $columns[] = qualifyColumn('r', $schema['route_price_column']) . ' AS base_price';
    } else {
        $columns[] = 'NULL AS base_price';
    }

    if ($schema['ticket_created_column'] !== null) {
        $columns[] = qualifyColumn('pt', $schema['ticket_created_column']) . ' AS issued_at';
    } else {
        $columns[] = 'NULL AS issued_at';
    }

    if ($schema['ticket_cancelled_at_column'] !== null) {
        $columns[] = qualifyColumn('pt', $schema['ticket_cancelled_at_column']) . ' AS cancelled_at';
    } else {
        $columns[] = 'NULL AS cancelled_at';
    }

    $query = 'SELECT ' . implode(', ', $columns)
        . ' FROM ' . quoteIdentifier($schema['ticket_table']) . ' AS pt '
        . 'INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('s', $schema['service_id_column']) . ' = ' . qualifyColumn('pt', $schema['ticket_service_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['service_route_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['user_table']) . ' AS u ON '
        . qualifyColumn('u', $schema['user_id_column']) . ' = ' . qualifyColumn('pt', $schema['ticket_user_column'])
        . ' WHERE ' . qualifyColumn('pt', $schema['ticket_id_column']) . ' = ?'
        . ' AND ' . qualifyColumn('pt', $schema['ticket_user_column']) . ' = ?';

    $stmt = $conn->prepare($query);
    $stmt->bind_param('ii', $ticketId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Ticket not found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    $price = $row['base_price'];

    return [
        'ticket_id' => (int) $row['ticket_id'],
        'user_id' => (int) $row['customer_id'],
        'username' => $row['username'] ?? null,
        'status' => (string) $row['status'],
        'service_id' => (int) $row['service_id'],
        'date' => $row['service_date'],
        'departure_time' => formatTimeForOutput($row['depart_time']),
        'arrival_time' => formatTimeForOutput($row['arrival_time']),
        'origin' => $row['origin_name'],
        'destination' => $row['dest_name'],
        'quantity' => isset($row['quantity']) ? (int) $row['quantity'] : 1,
        'price' => $price !== null ? formatPriceForOutput((string) $price) : '0.00',
        'issued_at' => $row['issued_at'] ?? null,
        'used_at' => null,
        'cancelled_at' => $row['cancelled_at'] ?? null,
    ];
}

function markRelationalTicketAsUsed(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $columns = [
            qualifyColumn('t', $schema['ticket_id_column']) . ' AS ticket_id',
            qualifyColumn('t', $schema['ticket_status_column']) . ' AS status',
            qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' AS customer_id',
        ];

        if ($schema['ticket_used_at_column'] !== null) {
            $columns[] = qualifyColumn('t', $schema['ticket_used_at_column']) . ' AS used_at';
        }

        $query = 'SELECT ' . implode(', ', $columns)
            . ' FROM ' . quoteIdentifier($schema['tickets_table']) . ' AS t'
            . ' WHERE ' . qualifyColumn('t', $schema['ticket_id_column']) . ' = ?'
            . ' AND ' . qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' = ?'
            . ' FOR UPDATE';

        if ($schema['ticket_deleted_column'] !== null) {
            $query = str_replace(' FOR UPDATE', ' AND ' . qualifyColumn('t', $schema['ticket_deleted_column']) . ' IS NULL FOR UPDATE', $query);
        }

        $stmt = $conn->prepare($query);
        $stmt->bind_param('ii', $ticketId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            $stmt->close();
            throw new InvalidArgumentException('Ticket not found.');
        }

        $row = $result->fetch_assoc();
        $stmt->close();

        $status = strtoupper((string) $row['status']);
        if ($status === 'USED') {
            throw new InvalidArgumentException('Ticket has already been used.');
        }
        if ($status === 'CANCELLED') {
            throw new InvalidArgumentException('Cancelled tickets cannot be used.');
        }
        if ($status === 'EXPIRED') {
            throw new InvalidArgumentException('Expired tickets cannot be used.');
        }

        $usedStatus = 'USED';
        $params = [$usedStatus];
        $types = 's';
        $setClauses = [quoteIdentifier($schema['ticket_status_column']) . ' = ?'];

        if ($schema['ticket_used_at_column'] !== null) {
            $usedAt = date('Y-m-d H:i:s');
            $setClauses[] = quoteIdentifier($schema['ticket_used_at_column']) . ' = ?';
            $params[] = $usedAt;
            $types .= 's';
        }

        $params[] = $ticketId;
        $params[] = $userId;
        $types .= 'ii';

        $update = 'UPDATE ' . quoteIdentifier($schema['tickets_table']) . ' SET ' . implode(', ', $setClauses)
            . ' WHERE ' . quoteIdentifier($schema['ticket_id_column']) . ' = ?'
            . ' AND ' . quoteIdentifier($schema['ticket_customer_fk_column']) . ' = ?';

        if ($schema['ticket_deleted_column'] !== null) {
            $update .= ' AND ' . quoteIdentifier($schema['ticket_deleted_column']) . ' IS NULL';
        }

        $updateStmt = $conn->prepare($update);
        bindDynamicParams($updateStmt, $types, $params);
        $updateStmt->execute();
        $updateStmt->close();

        $conn->commit();
        $transactionStarted = false;

        return fetchRelationalTicketForVerification($conn, $schema, $ticketId, $userId);
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function markLegacyTicketAsUsed(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $query = 'SELECT ' . qualifyColumn('pt', $schema['ticket_status_column']) . ' AS status'
            . ' FROM ' . quoteIdentifier($schema['ticket_table']) . ' AS pt'
            . ' WHERE ' . qualifyColumn('pt', $schema['ticket_id_column']) . ' = ?'
            . ' AND ' . qualifyColumn('pt', $schema['ticket_user_column']) . ' = ?'
            . ' FOR UPDATE';

        $stmt = $conn->prepare($query);
        $stmt->bind_param('ii', $ticketId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            $stmt->close();
            throw new InvalidArgumentException('Ticket not found.');
        }

        $row = $result->fetch_assoc();
        $stmt->close();

        $status = strtoupper((string) $row['status']);
        if ($status === 'USED') {
            throw new InvalidArgumentException('Ticket has already been used.');
        }
        if ($status === 'CANCELLED') {
            throw new InvalidArgumentException('Cancelled tickets cannot be used.');
        }
        if ($status === 'EXPIRED') {
            throw new InvalidArgumentException('Expired tickets cannot be used.');
        }

        $update = 'UPDATE ' . quoteIdentifier($schema['ticket_table'])
            . ' SET ' . quoteIdentifier($schema['ticket_status_column']) . " = 'USED'"
            . ' WHERE ' . quoteIdentifier($schema['ticket_id_column']) . ' = ?'
            . ' AND ' . quoteIdentifier($schema['ticket_user_column']) . ' = ?';

        $updateStmt = $conn->prepare($update);
        $updateStmt->bind_param('ii', $ticketId, $userId);
        $updateStmt->execute();
        $updateStmt->close();

        $conn->commit();
        $transactionStarted = false;

        return fetchLegacyTicketForVerification($conn, $schema, $ticketId, $userId);
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function bindDynamicParams(mysqli_stmt $stmt, string $types, array $params): void
{
    $values = [];
    $values[] = $types;
    foreach ($params as $key => $value) {
        $values[] = &$params[$key];
    }

    call_user_func_array([$stmt, 'bind_param'], $values);
}

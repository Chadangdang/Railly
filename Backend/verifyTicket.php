<?php
declare(strict_types=1);

header('Content-Type: application/json');

session_start();

require_once __DIR__ . '/db_connection.php';
require_once __DIR__ . '/schema_util.php';

if (!isset($_SESSION['staff_user_id']) || (int) $_SESSION['staff_user_id'] <= 0) {
    http_response_code(401);
    echo json_encode([
        'status' => 'error',
        'message' => 'Staff authentication required.',
    ]);
    exit;
}

$staffId = (int) $_SESSION['staff_user_id'];

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
        $action = isset($input['action']) ? strtolower(trim((string) $input['action'])) : 'use';
        $noteRaw = isset($input['note']) ? (string) $input['note'] : null;

        $note = normalizeStaffNote($noteRaw);

        if ($action === 'cancel') {
            if ($note === null) {
                throw new InvalidArgumentException('Please enter a note before cancelling the ticket.');
            }

            $ticket = cancelTicketByStaff($conn, $schema, $ticketId, $userId, $staffId, $note);
            $ticket = enrichTicketWithUsage($conn, $schema, $ticket);
            $ticket['message'] = buildStatusMessage($ticket['status']);

            echo json_encode([
                'status' => 'success',
                'ticket' => $ticket,
                'message' => 'Ticket cancelled successfully.',
            ]);
            return;
        }

        if ($action !== 'use') {
            throw new InvalidArgumentException('Unsupported action requested.');
        }

        $ticket = markTicketAsUsed($conn, $schema, $ticketId, $userId, $staffId, $note);
        $ticket = enrichTicketWithUsage($conn, $schema, $ticket);
        $ticket['message'] = buildStatusMessage($ticket['status']);

        echo json_encode([
            'status' => 'success',
            'ticket' => $ticket,
            'message' => 'Ticket marked as used successfully.',
        ]);
        return;
    }

    $ticket = fetchTicketForVerification($conn, $schema, $ticketId, $userId);
    $ticket = enrichTicketWithUsage($conn, $schema, $ticket);
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

function markTicketAsUsed(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId,
    ?int $staffId = null,
    ?string $note = null
): array {
    $usageTable = detectExistingTable($conn, ['ticket_usage_log']);

    if ($schema['variant'] === 'relational') {
        return markRelationalTicketAsUsed($conn, $schema, $ticketId, $userId, $usageTable, $staffId, $note);
    }

    return markLegacyTicketAsUsed($conn, $schema, $ticketId, $userId, $usageTable, $staffId, $note);
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

    if ($schema['ticket_cancel_reason_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_cancel_reason_column']) . ' AS cancel_reason';
    } else {
        $columns[] = 'NULL AS cancel_reason';
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
        'cancel_reason' => $row['cancel_reason'] ?? null,
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

    if ($schema['ticket_cancel_reason_column'] !== null) {
        $columns[] = qualifyColumn('pt', $schema['ticket_cancel_reason_column']) . ' AS cancel_reason';
    } else {
        $columns[] = 'NULL AS cancel_reason';
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
        'cancel_reason' => $row['cancel_reason'] ?? null,
    ];
}

function markRelationalTicketAsUsed(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId,
    ?string $usageTable,
    ?int $staffId,
    ?string $note
): array
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

        if ($usageTable !== null && $staffId !== null && $staffId > 0) {
            insertUsageLog($conn, $usageTable, $ticketId, $staffId, 'ACCEPTED', $note);
        }

        $conn->commit();
        $transactionStarted = false;

        return fetchRelationalTicketForVerification($conn, $schema, $ticketId, $userId);
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function markLegacyTicketAsUsed(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId,
    ?string $usageTable,
    ?int $staffId,
    ?string $note
): array
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

        if ($usageTable !== null && $staffId !== null && $staffId > 0) {
            insertUsageLog($conn, $usageTable, $ticketId, $staffId, 'ACCEPTED', $note);
        }

        $conn->commit();
        $transactionStarted = false;

        return fetchLegacyTicketForVerification($conn, $schema, $ticketId, $userId);
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function cancelTicketByStaff(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId,
    ?int $staffId,
    ?string $note
): array {
    $usageTable = detectExistingTable($conn, ['ticket_usage_log']);

    if ($schema['variant'] === 'relational') {
        return cancelRelationalTicketByStaff($conn, $schema, $ticketId, $userId, $usageTable, $staffId, $note);
    }

    return cancelLegacyTicketByStaff($conn, $schema, $ticketId, $userId, $usageTable, $staffId, $note);
}

function normalizeStaffNote(?string $note): ?string
{
    if ($note === null) {
        return null;
    }

    $trimmed = trim($note);
    if ($trimmed === '') {
        return null;
    }

    $length = function_exists('mb_strlen') ? mb_strlen($trimmed, 'UTF-8') : strlen($trimmed);
    if ($length > 100) {
        throw new InvalidArgumentException('Note must be 100 characters or fewer.');
    }

    return $trimmed;
}

function insertUsageLog(
    mysqli $conn,
    string $usageTable,
    int $ticketId,
    int $staffId,
    string $result,
    ?string $note
): void {
    $sql = sprintf(
        'INSERT INTO %s (%s, %s, %s, %s) VALUES (?, ?, ?, ?)',
        quoteIdentifier($usageTable),
        quoteIdentifier('ticket_id'),
        quoteIdentifier('staff_user_id'),
        quoteIdentifier('result'),
        quoteIdentifier('note')
    );

    $stmt = $conn->prepare($sql);
    $normalizedResult = strtoupper(trim($result));
    if ($normalizedResult === '') {
        $normalizedResult = 'ACCEPTED';
    }

    $types = 'iiss';
    $params = [$ticketId, $staffId, $normalizedResult, $note];
    bindDynamicParams($stmt, $types, $params);
    $stmt->execute();
    $stmt->close();
}

function enrichTicketWithUsage(mysqli $conn, array $schema, array $ticket): array
{
    $usageTable = detectExistingTable($conn, ['ticket_usage_log']);
    if ($usageTable === null) {
        $ticket['usage_logs'] = null;
        $ticket['cancelled_by_staff'] = null;
        return $ticket;
    }

    $ticketId = isset($ticket['ticket_id']) ? (int) $ticket['ticket_id'] : 0;
    if ($ticketId <= 0) {
        $ticket['usage_logs'] = null;
        $ticket['cancelled_by_staff'] = null;
        return $ticket;
    }

    $latest = fetchLatestUsageLog($conn, $usageTable, $ticketId, null);
    $latestRejection = fetchLatestUsageLog($conn, $usageTable, $ticketId, 'REJECTED');

    $ticket['usage_logs'] = [
        'latest' => $latest,
        'latest_rejection' => $latestRejection,
    ];

    $ticket['cancelled_by_staff'] = $latestRejection;

    return $ticket;
}

function fetchLatestUsageLog(
    mysqli $conn,
    string $usageTable,
    int $ticketId,
    ?string $resultFilter
): ?array {
    $staffTable = detectExistingTable($conn, ['staff_users']);

    $columns = [
        'log.' . quoteIdentifier('result') . ' AS result',
        'log.' . quoteIdentifier('note') . ' AS note',
        'log.' . quoteIdentifier('used_at') . ' AS used_at',
        'log.' . quoteIdentifier('staff_user_id') . ' AS staff_user_id',
    ];

    $join = '';
    if ($staffTable !== null) {
        $columns[] = 'staff.' . quoteIdentifier('username') . ' AS staff_username';
        $join = ' LEFT JOIN ' . quoteIdentifier($staffTable) . ' AS staff ON '
            . 'staff.' . quoteIdentifier('staff_user_id') . ' = log.' . quoteIdentifier('staff_user_id');
    }

    $sql = 'SELECT ' . implode(', ', $columns)
        . ' FROM ' . quoteIdentifier($usageTable) . ' AS log'
        . $join
        . ' WHERE log.' . quoteIdentifier('ticket_id') . ' = ?';

    $types = 'i';
    $params = [$ticketId];

    if ($resultFilter !== null) {
        $sql .= ' AND log.' . quoteIdentifier('result') . ' = ?';
        $types .= 's';
        $params[] = strtoupper(trim($resultFilter));
    }

    $sql .= ' ORDER BY log.' . quoteIdentifier('used_at') . ' DESC LIMIT 1';

    $stmt = $conn->prepare($sql);
    bindDynamicParams($stmt, $types, $params);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        return null;
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    return [
        'result' => $row['result'],
        'note' => $row['note'] !== null ? (string) $row['note'] : null,
        'used_at' => $row['used_at'] ?? null,
        'staff_user_id' => $row['staff_user_id'] !== null ? (int) $row['staff_user_id'] : null,
        'staff_username' => $row['staff_username'] ?? null,
    ];
}

function cancelRelationalTicketByStaff(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId,
    ?string $usageTable,
    ?int $staffId,
    ?string $note
): array {
    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $ticketRow = lockRelationalTicketForUpdate($conn, $schema, $ticketId, $userId);

        $status = strtoupper((string) $ticketRow['status']);
        if ($status === 'CANCELLED') {
            throw new InvalidArgumentException('Ticket has already been cancelled.');
        }
        if ($status === 'USED') {
            throw new InvalidArgumentException('Used tickets cannot be cancelled.');
        }
        if ($status === 'EXPIRED') {
            throw new InvalidArgumentException('Expired tickets cannot be cancelled.');
        }

        $serviceId = isset($ticketRow['service_id']) ? (int) $ticketRow['service_id'] : 0;
        if ($serviceId <= 0) {
            throw new InvalidArgumentException('Related service could not be found for this ticket.');
        }

        $cancelledStatus = 'CANCELLED';
        $setClauses = [quoteIdentifier($schema['ticket_status_column']) . ' = ?'];
        $params = [$cancelledStatus];
        $types = 's';

        if ($schema['ticket_cancelled_at_column'] !== null) {
            $cancelTimestamp = date('Y-m-d H:i:s');
            $setClauses[] = quoteIdentifier($schema['ticket_cancelled_at_column']) . ' = ?';
            $params[] = $cancelTimestamp;
            $types .= 's';
        }

        if ($schema['ticket_cancel_reason_column'] !== null) {
            $setClauses[] = quoteIdentifier($schema['ticket_cancel_reason_column']) . ' = ?';
            $params[] = 'STAFF_CANCELLED';
            $types .= 's';
        }

        $params[] = $ticketId;
        $params[] = $userId;
        $types .= 'ii';

        $updateSql = sprintf(
            'UPDATE %s SET %s WHERE %s = ? AND %s = ?',
            quoteIdentifier($schema['tickets_table']),
            implode(', ', $setClauses),
            quoteIdentifier($schema['ticket_id_column']),
            quoteIdentifier($schema['ticket_customer_fk_column'])
        );

        if ($schema['ticket_deleted_column'] !== null) {
            $updateSql .= ' AND ' . quoteIdentifier($schema['ticket_deleted_column']) . ' IS NULL';
        }

        $updateStmt = $conn->prepare($updateSql);
        bindDynamicParams($updateStmt, $types, $params);
        $updateStmt->execute();
        $updateStmt->close();

        if ($schema['service_available_column'] !== null) {
            $serviceRow = lockRelationalServiceForUpdate($conn, $schema, $serviceId);
            $available = isset($serviceRow['available']) ? (int) $serviceRow['available'] : 0;
            $capacity = isset($serviceRow['capacity']) && $serviceRow['capacity'] !== null
                ? (int) $serviceRow['capacity']
                : null;

            $newAvailable = $available + 1;
            if ($capacity !== null && $schema['service_capacity_column'] !== $schema['service_available_column']) {
                $newAvailable = min($newAvailable, $capacity);
            }

            $serviceUpdateSql = sprintf(
                'UPDATE %s SET %s = ? WHERE %s = ?',
                quoteIdentifier($schema['service_table']),
                quoteIdentifier($schema['service_available_column']),
                quoteIdentifier($schema['service_id_column'])
            );

            $serviceUpdateStmt = $conn->prepare($serviceUpdateSql);
            $serviceUpdateStmt->bind_param('ii', $newAvailable, $serviceId);
            $serviceUpdateStmt->execute();
            $serviceUpdateStmt->close();
        }

        if ($usageTable !== null && $staffId !== null && $staffId > 0) {
            insertUsageLog($conn, $usageTable, $ticketId, $staffId, 'REJECTED', $note);
        }

        $conn->commit();
        $transactionStarted = false;

        return fetchRelationalTicketForVerification($conn, $schema, $ticketId, $userId);
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function cancelLegacyTicketByStaff(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId,
    ?string $usageTable,
    ?int $staffId,
    ?string $note
): array {
    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $ticketRow = lockLegacyTicketForUpdate($conn, $schema, $ticketId, $userId);

        $status = strtoupper((string) $ticketRow['status']);
        if ($status === 'CANCELLED') {
            throw new InvalidArgumentException('Ticket has already been cancelled.');
        }
        if ($status === 'USED') {
            throw new InvalidArgumentException('Used tickets cannot be cancelled.');
        }
        if ($status === 'EXPIRED') {
            throw new InvalidArgumentException('Expired tickets cannot be cancelled.');
        }

        $serviceId = isset($ticketRow['service_id']) ? (int) $ticketRow['service_id'] : 0;
        if ($serviceId <= 0) {
            throw new InvalidArgumentException('Related service could not be found for this ticket.');
        }

        $quantity = isset($ticketRow['quantity']) ? (int) $ticketRow['quantity'] : 1;
        if ($quantity <= 0) {
            $quantity = 1;
        }

        $cancelledStatus = 'CANCELLED';
        $setClauses = [quoteIdentifier($schema['ticket_status_column']) . ' = ?'];
        $params = [$cancelledStatus];
        $types = 's';

        if ($schema['ticket_cancelled_at_column'] !== null) {
            $cancelTimestamp = date('Y-m-d H:i:s');
            $setClauses[] = quoteIdentifier($schema['ticket_cancelled_at_column']) . ' = ?';
            $params[] = $cancelTimestamp;
            $types .= 's';
        }

        if ($schema['ticket_cancel_reason_column'] !== null) {
            $setClauses[] = quoteIdentifier($schema['ticket_cancel_reason_column']) . ' = ?';
            $params[] = 'STAFF_CANCELLED';
            $types .= 's';
        }

        $params[] = $ticketId;
        $params[] = $userId;
        $types .= 'ii';

        $updateSql = sprintf(
            'UPDATE %s SET %s WHERE %s = ? AND %s = ?',
            quoteIdentifier($schema['ticket_table']),
            implode(', ', $setClauses),
            quoteIdentifier($schema['ticket_id_column']),
            quoteIdentifier($schema['ticket_user_column'])
        );

        $updateStmt = $conn->prepare($updateSql);
        bindDynamicParams($updateStmt, $types, $params);
        $updateStmt->execute();
        $updateStmt->close();

        if ($schema['service_available_column'] !== null) {
            $serviceRow = lockLegacyServiceForUpdate($conn, $schema, $serviceId);
            $available = isset($serviceRow['available']) ? (int) $serviceRow['available'] : 0;
            $newAvailable = $available + $quantity;

            $serviceUpdateSql = sprintf(
                'UPDATE %s SET %s = ? WHERE %s = ?',
                quoteIdentifier($schema['service_table']),
                quoteIdentifier($schema['service_available_column']),
                quoteIdentifier($schema['service_id_column'])
            );

            $serviceUpdateStmt = $conn->prepare($serviceUpdateSql);
            $serviceUpdateStmt->bind_param('ii', $newAvailable, $serviceId);
            $serviceUpdateStmt->execute();
            $serviceUpdateStmt->close();
        }

        if ($usageTable !== null && $staffId !== null && $staffId > 0) {
            insertUsageLog($conn, $usageTable, $ticketId, $staffId, 'REJECTED', $note);
        }

        $conn->commit();
        $transactionStarted = false;

        return fetchLegacyTicketForVerification($conn, $schema, $ticketId, $userId);
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function lockRelationalTicketForUpdate(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId
): array {
    $columns = [
        qualifyColumn('t', $schema['ticket_status_column']) . ' AS status',
        qualifyColumn('t', $schema['ticket_service_fk_column']) . ' AS service_id',
    ];

    $conditions = [
        qualifyColumn('t', $schema['ticket_id_column']) . ' = ?',
        qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' = ?',
    ];

    if ($schema['ticket_deleted_column'] !== null) {
        $conditions[] = qualifyColumn('t', $schema['ticket_deleted_column']) . ' IS NULL';
    }

    $sql = sprintf(
        'SELECT %s FROM %s AS t WHERE %s FOR UPDATE',
        implode(', ', $columns),
        quoteIdentifier($schema['tickets_table']),
        implode(' AND ', $conditions)
    );

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ii', $ticketId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Ticket not found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    return $row;
}

function lockRelationalServiceForUpdate(
    mysqli $conn,
    array $schema,
    int $serviceId
): array {
    $columns = [
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
    ];

    if ($schema['service_available_column'] !== null) {
        $columns[] = qualifyColumn('s', $schema['service_available_column']) . ' AS available';
    } else {
        $columns[] = 'NULL AS available';
    }

    if ($schema['service_capacity_column'] !== null) {
        $columns[] = qualifyColumn('s', $schema['service_capacity_column']) . ' AS capacity';
    } else {
        $columns[] = 'NULL AS capacity';
    }

    $sql = sprintf(
        'SELECT %s FROM %s AS s WHERE %s = ? FOR UPDATE',
        implode(', ', $columns),
        quoteIdentifier($schema['service_table']),
        qualifyColumn('s', $schema['service_id_column'])
    );

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $serviceId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Related service could not be found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    return $row;
}

function lockLegacyTicketForUpdate(
    mysqli $conn,
    array $schema,
    int $ticketId,
    int $userId
): array {
    $columns = [
        qualifyColumn('pt', $schema['ticket_status_column']) . ' AS status',
        qualifyColumn('pt', $schema['ticket_service_column']) . ' AS service_id',
        qualifyColumn('pt', $schema['ticket_quantity_column']) . ' AS quantity',
    ];

    $sql = sprintf(
        'SELECT %s FROM %s AS pt WHERE %s = ? AND %s = ? FOR UPDATE',
        implode(', ', $columns),
        quoteIdentifier($schema['ticket_table']),
        qualifyColumn('pt', $schema['ticket_id_column']),
        qualifyColumn('pt', $schema['ticket_user_column'])
    );

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('ii', $ticketId, $userId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Ticket not found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    return $row;
}

function lockLegacyServiceForUpdate(
    mysqli $conn,
    array $schema,
    int $serviceId
): array {
    $columns = [
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        qualifyColumn('s', $schema['service_available_column']) . ' AS available',
    ];

    $sql = sprintf(
        'SELECT %s FROM %s AS s WHERE %s = ? FOR UPDATE',
        implode(', ', $columns),
        quoteIdentifier($schema['service_table']),
        qualifyColumn('s', $schema['service_id_column'])
    );

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $serviceId);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('Related service could not be found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    return $row;
}

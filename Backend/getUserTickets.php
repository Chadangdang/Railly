<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';
require_once __DIR__ . '/schema_util.php';

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
    $schema = determineBookingSchema($conn);

    expirePastTickets($conn, $schema);

    fetchValidatedUser(
        $conn,
        $schema['user_table'],
        $schema['user_id_column'],
        $schema['user_name_column'],
        $userId,
        $username
    );

    if ($schema['variant'] === 'relational') {
        $tickets = fetchRelationalUserTickets($conn, $schema, $userId);
    } else {
        $tickets = fetchLegacyUserTickets($conn, $schema, $userId);
    }

    echo json_encode(['status' => 'success', 'tickets' => $tickets]);
} catch (InvalidArgumentException $exception) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('getUserTickets error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to retrieve user tickets.']);
} finally {
    $conn->close();
}

function expirePastTickets(mysqli $conn, array $schema): void
{
    if ($schema['variant'] === 'relational') {
        expirePastRelationalTickets($conn, $schema);
    } else {
        expirePastLegacyTickets($conn, $schema);
    }
}

function expirePastRelationalTickets(mysqli $conn, array $schema): void
{
    $sql = 'UPDATE ' . quoteIdentifier($schema['tickets_table']) . ' AS t '
        . 'INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('t', $schema['ticket_service_fk_column']) . ' = '
        . qualifyColumn('s', $schema['service_id_column']) . ' '
        . "SET " . qualifyColumn('t', $schema['ticket_status_column']) . " = 'EXPIRED' "
        . "WHERE " . qualifyColumn('t', $schema['ticket_status_column']) . " IN ('PAID','USED') "
        . 'AND ' . qualifyColumn('s', $schema['service_depart_column']) . ' <= NOW()';

    if ($conn->query($sql) === false) {
        error_log('expirePastRelationalTickets failed: ' . $conn->error);
    }
}

function expirePastLegacyTickets(mysqli $conn, array $schema): void
{
    $sql = 'UPDATE ' . quoteIdentifier($schema['ticket_table']) . ' AS pt '
        . 'INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('pt', $schema['ticket_service_column']) . ' = '
        . qualifyColumn('s', $schema['service_id_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('s', $schema['service_route_column']) . ' = '
        . qualifyColumn('r', $schema['route_pk_column']) . ' '
        . "SET " . qualifyColumn('pt', $schema['ticket_status_column']) . " = 'EXPIRED' "
        . "WHERE " . qualifyColumn('pt', $schema['ticket_status_column']) . " IN ('PAID','USED') "
        . 'AND TIMESTAMP(' . qualifyColumn('s', $schema['service_date_column']) . ', '
        . qualifyColumn('r', $schema['route_depart_column']) . ') <= NOW()';

    if ($conn->query($sql) === false) {
        error_log('expirePastLegacyTickets failed: ' . $conn->error);
    }
}

function fetchRelationalUserTickets(mysqli $conn, array $schema, int $userId): array
{
    $selectParts = [
        qualifyColumn('t', $schema['ticket_id_column']) . ' AS ticket_id',
        qualifyColumn('t', $schema['ticket_status_column']) . ' AS status',
        $schema['ticket_unit_price_column'] !== null
            ? qualifyColumn('t', $schema['ticket_unit_price_column']) . ' AS unit_price'
            : 'NULL AS unit_price',
        $schema['ticket_issued_at_column'] !== null
            ? qualifyColumn('t', $schema['ticket_issued_at_column']) . ' AS issued_at'
            : 'NULL AS issued_at',
        $schema['ticket_cancelled_at_column'] !== null
            ? qualifyColumn('t', $schema['ticket_cancelled_at_column']) . ' AS cancelled_at'
            : 'NULL AS cancelled_at',
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        'DATE(' . qualifyColumn('s', $schema['service_depart_column']) . ') AS service_date',
        'TIME(' . qualifyColumn('s', $schema['service_depart_column']) . ') AS depart_time',
        'TIME(' . qualifyColumn('s', $schema['service_arrival_column']) . ') AS arrival_time',
        qualifyColumn('origin', $schema['station_name_column']) . ' AS origin_name',
        qualifyColumn('dest', $schema['station_name_column']) . ' AS dest_name',
    ];

    if ($schema['station_code_column'] !== null) {
        $selectParts[] = qualifyColumn('origin', $schema['station_code_column']) . ' AS origin_code';
        $selectParts[] = qualifyColumn('dest', $schema['station_code_column']) . ' AS dest_code';
    } else {
        $selectParts[] = 'NULL AS origin_code';
        $selectParts[] = 'NULL AS dest_code';
    }

    if ($schema['route_price_column'] !== null) {
        $selectParts[] = qualifyColumn('r', $schema['route_price_column']) . ' AS base_price';
    } else {
        $selectParts[] = 'NULL AS base_price';
    }

    $query = 'SELECT ' . implode(', ', $selectParts)
        . ' FROM ' . quoteIdentifier($schema['tickets_table']) . ' AS t '
        . 'INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('s', $schema['service_id_column']) . ' = ' . qualifyColumn('t', $schema['ticket_service_fk_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['service_route_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS origin ON '
        . qualifyColumn('origin', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['origin_station_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS dest ON '
        . qualifyColumn('dest', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['dest_station_column'])
        . ' WHERE ' . qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' = ?'
        . " AND " . qualifyColumn('t', $schema['ticket_status_column']) . " IN ('PAID','USED','CANCELLED','EXPIRED')";

    if ($schema['ticket_deleted_column'] !== null) {
        $query .= ' AND ' . qualifyColumn('t', $schema['ticket_deleted_column']) . ' IS NULL';
    }

    $query .= ' ORDER BY ' . qualifyColumn('s', $schema['service_depart_column'])
        . ', ' . qualifyColumn('t', $schema['ticket_id_column']);

    $stmt = $conn->prepare($query);
    $stmt->bind_param('i', $userId);
    $stmt->execute();

    $result = $stmt->get_result();
    $tickets = [];

    while ($row = $result->fetch_assoc()) {
        $origin = buildStationLabel($row['origin_name'], $row['origin_code'] ?? null);
        $destination = buildStationLabel($row['dest_name'], $row['dest_code'] ?? null);
        $unitPrice = $row['unit_price'];

        if ($unitPrice === null || $unitPrice === '' ) {
            $unitPrice = $row['base_price'];
        }

        $price = $unitPrice !== null ? formatPriceForOutput((string) $unitPrice) : '0.00';

        $tickets[] = [
            'ticket_id' => (int) $row['ticket_id'],
            'route_id' => (int) $row['service_id'],
            'origin' => $origin,
            'destination' => $destination,
            'departure' => formatTimeForOutput($row['depart_time']),
            'arrival' => formatTimeForOutput($row['arrival_time']),
            'price' => $price,
            'datee' => $row['service_date'],
            'quantity' => 1,
            'status' => $row['status'],
            'created_at' => $row['issued_at'] ?? null,
            'cancelled_at' => $row['cancelled_at'] ?? null,
        ];
    }

    $stmt->close();

    return $tickets;
}

function fetchLegacyUserTickets(mysqli $conn, array $schema, int $userId): array
{
    $query = sprintf(
        'SELECT %s AS ticket_id, %s AS quantity, %s AS status, %s AS created_at, %s AS cancelled_at, '
        . '%s AS service_id, %s AS service_date, %s AS origin, %s AS dest, %s AS depart_time, %s AS arrival_time, %s AS price_thb '
        . 'FROM %s AS pt '
        . 'INNER JOIN %s AS s ON %s = %s '
        . 'INNER JOIN %s AS r ON %s = %s '
        . 'WHERE %s = ? AND %s = ? '
        . 'ORDER BY %s, %s',
        qualifyColumn('pt', $schema['ticket_id_column']),
        qualifyColumn('pt', $schema['ticket_quantity_column']),
        qualifyColumn('pt', $schema['ticket_status_column']),
        $schema['ticket_created_column'] !== null
            ? qualifyColumn('pt', $schema['ticket_created_column'])
            : 'NULL',
        $schema['ticket_cancelled_at_column'] !== null
            ? qualifyColumn('pt', $schema['ticket_cancelled_at_column'])
            : 'NULL',
        qualifyColumn('s', $schema['service_id_column']),
        qualifyColumn('s', $schema['service_date_column']),
        qualifyColumn('r', $schema['route_origin_column']),
        qualifyColumn('r', $schema['route_dest_column']),
        qualifyColumn('r', $schema['route_depart_column']),
        qualifyColumn('r', $schema['route_arrival_column']),
        $schema['route_price_column'] !== null
            ? qualifyColumn('r', $schema['route_price_column'])
            : "'0'",
        quoteIdentifier($schema['ticket_table']),
        quoteIdentifier($schema['service_table']),
        qualifyColumn('pt', $schema['ticket_service_column']),
        qualifyColumn('s', $schema['service_id_column']),
        quoteIdentifier($schema['route_table']),
        qualifyColumn('s', $schema['service_route_column']),
        qualifyColumn('r', $schema['route_pk_column']),
        qualifyColumn('pt', $schema['ticket_user_column']),
        qualifyColumn('pt', $schema['ticket_status_column']),
        qualifyColumn('s', $schema['service_date_column']),
        qualifyColumn('r', $schema['route_depart_column'])
    );

    $status = 'PAID';
    $stmt = $conn->prepare($query);
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
            'price' => formatPriceForOutput((string) $row['price_thb']),
            'datee' => $row['service_date'],
            'quantity' => (int) $row['quantity'],
            'status' => $row['status'],
            'created_at' => $row['created_at'],
            'cancelled_at' => $row['cancelled_at'],
        ];
    }

    $stmt->close();

    return $tickets;
}

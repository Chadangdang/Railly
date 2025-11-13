<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

$mode = isset($_GET['mode']) ? strtolower(trim((string) $_GET['mode'])) : 'search';
$origin = isset($_GET['origin']) ? trim((string) $_GET['origin']) : '';
$destination = isset($_GET['dest']) ? trim((string) $_GET['dest']) : '';
$date = isset($_GET['datee']) ? trim((string) $_GET['datee']) : '';

if ($mode !== 'today') {
    if ($origin === '' || $destination === '' || $date === '') {
        echo json_encode([
            'status' => 'error',
            'message' => 'Missing required parameters: origin, destination, or date.'
        ]);
        exit;
    }
} elseif ($date === '') {
    $date = date('Y-m-d');
}

$conn = get_db_connection();

try {
    $schema = determineTicketSchema($conn);

    if ($schema['variant'] === 'relational') {
        $tickets = fetchRelationalTickets($conn, $schema, $mode, $origin, $destination, $date);
    } else {
        $tickets = fetchLegacyTickets($conn, $schema, $mode, $origin, $destination, $date);
    }

    if (empty($tickets)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'No tickets found for the given search criteria.'
        ]);
        return;
    }

    echo json_encode($tickets);
} catch (Throwable $exception) {
    error_log('getTickets error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Failed to retrieve tickets.'
    ]);
} finally {
    $conn->close();
}

function determineTicketSchema(mysqli $conn): array
{
    $serviceTable = detectExistingTable($conn, ['service', 'services']);
    $routeTable = detectExistingTable($conn, ['route', 'routes']);

    if ($serviceTable === null || $routeTable === null) {
        throw new RuntimeException('Required service or route tables are missing.');
    }

    $usesRelationalSchema = tableHasColumns($conn, $routeTable, ['origin_station_id', 'dest_station_id'])
        && tableHasColumns($conn, $serviceTable, ['depart_at', 'arrive_at', 'capacity']);

    if ($usesRelationalSchema) {
        $stationTable = detectExistingTable($conn, ['stations', 'station']);

        if ($stationTable === null) {
            throw new RuntimeException('Stations table is required for relational ticket queries.');
        }

        $schema = [
            'variant' => 'relational',
            'service_table' => $serviceTable,
            'route_table' => $routeTable,
            'station_table' => $stationTable,
            'service_id_column' => detectColumn($conn, $serviceTable, ['service_id', 'id']),
            'route_fk_column' => detectColumn($conn, $serviceTable, ['route_id']),
            'route_pk_column' => detectColumn($conn, $routeTable, ['route_id']),
            'origin_station_column' => detectColumn($conn, $routeTable, ['origin_station_id']),
            'dest_station_column' => detectColumn($conn, $routeTable, ['dest_station_id']),
            'depart_column' => detectColumn($conn, $serviceTable, ['depart_at']),
            'arrival_column' => detectColumn($conn, $serviceTable, ['arrive_at', 'arrival_at']),
            'capacity_column' => detectColumn($conn, $serviceTable, ['capacity']),
            'available_column' => detectColumn($conn, $serviceTable, ['available', 'available_ticket', 'available_tickets', 'remaining_ticket']),
            'price_column' => detectColumn($conn, $routeTable, ['base_price', 'price_thb', 'price']),
            'station_id_column' => detectColumn($conn, $stationTable, ['station_id', 'id']),
            'station_name_column' => detectColumn($conn, $stationTable, ['name', 'station_name']),
            'station_code_column' => detectColumn($conn, $stationTable, ['code', 'station_code']),
            'status_column' => detectColumn($conn, $serviceTable, ['status', 'service_status'])
        ];

        foreach ([
            'service_id_column',
            'route_fk_column',
            'route_pk_column',
            'origin_station_column',
            'dest_station_column',
            'depart_column',
            'arrival_column',
            'capacity_column',
            'station_id_column',
            'station_name_column'
        ] as $requiredKey) {
            if ($schema[$requiredKey] === null) {
                throw new RuntimeException('Relational schema missing required column: ' . $requiredKey);
            }
        }

        return $schema;
    }

    $schema = [
        'variant' => 'legacy',
        'service_table' => $serviceTable,
        'route_table' => $routeTable,
        'service_id_column' => detectColumn($conn, $serviceTable, ['service_id', 'id']),
        'route_fk_column' => detectColumn($conn, $serviceTable, ['route_id']),
        'route_pk_column' => detectColumn($conn, $routeTable, ['route_id']),
        'service_date_column' => detectColumn($conn, $serviceTable, ['service_date', 'datee']),
        'depart_column' => detectColumn($conn, $routeTable, ['depart_time', 'departure_time']),
        'arrival_column' => detectColumn($conn, $routeTable, ['arrival_time', 'arrive_time']),
        'origin_column' => detectColumn($conn, $routeTable, ['origin', 'origin_station']),
        'dest_column' => detectColumn($conn, $routeTable, ['dest', 'destination', 'dest_station']),
        'price_column' => detectColumn($conn, $routeTable, ['price_thb', 'price']),
        'available_column' => detectColumn($conn, $serviceTable, ['available_ticket', 'available_tickets', 'remaining_ticket']),
        'total_column' => detectColumn($conn, $serviceTable, ['total_ticket', 'capacity'])
    ];

    foreach ([
        'service_id_column',
        'route_fk_column',
        'route_pk_column',
        'service_date_column',
        'depart_column',
        'arrival_column',
        'origin_column',
        'dest_column'
    ] as $requiredKey) {
        if ($schema[$requiredKey] === null) {
            throw new RuntimeException('Legacy schema missing required column: ' . $requiredKey);
        }
    }

    return $schema;
}

function fetchLegacyTickets(mysqli $conn, array $schema, string $mode, string $origin, string $destination, string $date): array
{
    $selectParts = [
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        qualifyColumn('r', $schema['origin_column']) . ' AS origin',
        qualifyColumn('r', $schema['dest_column']) . ' AS dest',
        qualifyColumn('r', $schema['depart_column']) . ' AS depart_time',
        qualifyColumn('r', $schema['arrival_column']) . ' AS arrival_time'
    ];

    if ($schema['price_column'] !== null) {
        $selectParts[] = qualifyColumn('r', $schema['price_column']) . ' AS price_thb';
    } else {
        $selectParts[] = 'NULL AS price_thb';
    }

    $selectParts[] = qualifyColumn('s', $schema['service_date_column']) . ' AS service_date';
    $selectParts[] = $schema['available_column'] !== null
        ? qualifyColumn('s', $schema['available_column']) . ' AS available_ticket'
        : 'NULL AS available_ticket';
    $selectParts[] = $schema['total_column'] !== null
        ? qualifyColumn('s', $schema['total_column']) . ' AS total_ticket'
        : 'NULL AS total_ticket';

    $query = 'SELECT ' . implode(', ', $selectParts)
        . ' FROM ' . quoteIdentifier($schema['service_table']) . ' AS s '
        . 'INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['route_fk_column']);

    $orderClause = ' ORDER BY ' . qualifyColumn('r', $schema['depart_column']) . ' ASC';

    if ($mode === 'today') {
        $query .= ' WHERE ' . qualifyColumn('s', $schema['service_date_column']) . ' = ?' . $orderClause;
        $stmt = $conn->prepare($query);
        $stmt->bind_param('s', $date);
    } else {
        $query .= ' WHERE ' . qualifyColumn('r', $schema['origin_column']) . ' = ? AND '
            . qualifyColumn('r', $schema['dest_column']) . ' = ? AND '
            . qualifyColumn('s', $schema['service_date_column']) . ' = ?' . $orderClause;
        $stmt = $conn->prepare($query);
        $stmt->bind_param('sss', $origin, $destination, $date);
    }

    return collectTicketsFromStatement($stmt);
}

function fetchRelationalTickets(mysqli $conn, array $schema, string $mode, string $origin, string $destination, string $date): array
{
    $selectParts = [
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        qualifyColumn('origin', $schema['station_name_column']) . ' AS origin',
        qualifyColumn('dest', $schema['station_name_column']) . ' AS dest',
        'TIME(' . qualifyColumn('s', $schema['depart_column']) . ') AS depart_time',
        'TIME(' . qualifyColumn('s', $schema['arrival_column']) . ') AS arrival_time',
        $schema['price_column'] !== null
            ? qualifyColumn('r', $schema['price_column']) . ' AS price_thb'
            : 'NULL AS price_thb',
        'DATE(' . qualifyColumn('s', $schema['depart_column']) . ') AS service_date'
    ];

    if ($schema['station_code_column'] !== null) {
        $selectParts[] = qualifyColumn('origin', $schema['station_code_column']) . ' AS origin_code';
        $selectParts[] = qualifyColumn('dest', $schema['station_code_column']) . ' AS dest_code';
    } else {
        $selectParts[] = 'NULL AS origin_code';
        $selectParts[] = 'NULL AS dest_code';
    }

    $soldJoin = '';
    $availableExpression = null;

    if ($schema['available_column'] !== null) {
        $availableExpression = 'GREATEST(COALESCE(' . qualifyColumn('s', $schema['available_column']) . ', 0), 0)';

        if ($schema['capacity_column'] !== null) {
            $availableExpression = 'LEAST(' . qualifyColumn('s', $schema['capacity_column']) . ', ' . $availableExpression . ')';
        }
    } elseif ($schema['capacity_column'] !== null) {
        $availableExpression = qualifyColumn('s', $schema['capacity_column']);

        if (tableHasColumns($conn, 'tickets', ['service_id', 'status'])) {
            $availableExpression = 'GREATEST(' . qualifyColumn('s', $schema['capacity_column']) . ' - COALESCE(sold.sold_count, 0), 0)';
            $soldJoin = 'LEFT JOIN (SELECT service_id, COUNT(*) AS sold_count FROM ' . quoteIdentifier('tickets') . " WHERE status IN ('PAID','USED') GROUP BY service_id) AS sold ON sold.service_id = " . qualifyColumn('s', $schema['service_id_column']);
        }
    } else {
        $availableExpression = '0';
    }

    $selectParts[] = $availableExpression . ' AS available_ticket';
    $selectParts[] = qualifyColumn('s', $schema['capacity_column']) . ' AS total_ticket';

    $query = 'SELECT ' . implode(', ', $selectParts)
        . ' FROM ' . quoteIdentifier($schema['service_table']) . ' AS s '
        . 'INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['route_fk_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS origin ON '
        . qualifyColumn('origin', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['origin_station_column']) . ' '
        . 'INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS dest ON '
        . qualifyColumn('dest', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['dest_station_column']) . ' '
        . $soldJoin;

    $orderClause = ' ORDER BY TIME(' . qualifyColumn('s', $schema['depart_column']) . ') ASC';

    $whereConditions = [];

    if ($schema['status_column'] !== null) {
        $whereConditions[] = 'UPPER(' . qualifyColumn('s', $schema['status_column']) . ") = 'OPEN'";
    }

    if ($mode === 'today') {
        $whereConditions[] = 'DATE(' . qualifyColumn('s', $schema['depart_column']) . ') = ?';
        $whereClause = empty($whereConditions) ? '' : ' WHERE ' . implode(' AND ', $whereConditions);
        $query .= $whereClause . $orderClause;
        $stmt = $conn->prepare($query);
        $stmt->bind_param('s', $date);
    } else {
        $whereConditions[] = qualifyColumn('origin', $schema['station_name_column']) . ' = ?';
        $whereConditions[] = qualifyColumn('dest', $schema['station_name_column']) . ' = ?';
        $whereConditions[] = 'DATE(' . qualifyColumn('s', $schema['depart_column']) . ') = ?';
        $whereClause = empty($whereConditions) ? '' : ' WHERE ' . implode(' AND ', $whereConditions);
        $query .= $whereClause . $orderClause;
        $stmt = $conn->prepare($query);
        $stmt->bind_param('sss', $origin, $destination, $date);
    }

    return collectTicketsFromStatement($stmt);
}

function collectTicketsFromStatement(mysqli_stmt $stmt): array
{
    $stmt->execute();
    $result = $stmt->get_result();
    $tickets = [];

    while ($row = $result->fetch_assoc()) {
        $tickets[] = buildTicketResponseRow($row);
    }

    $result->free();
    $stmt->close();

    return $tickets;
}

function buildTicketResponseRow(array $row): array
{
    $priceRaw = $row['price_thb'] ?? $row['price'] ?? null;
    $priceValue = ($priceRaw === null || $priceRaw === '') ? '0' : (string) $priceRaw;
    $availableRaw = $row['available_ticket'] ?? null;
    $totalRaw = $row['total_ticket'] ?? ($row['capacity'] ?? null);

    return [
        'route_id' => isset($row['service_id']) ? (int) $row['service_id'] : (isset($row['route_id']) ? (int) $row['route_id'] : 0),
        'origin' => $row['origin'] ?? '',
        'dest' => $row['dest'] ?? '',
        'origin_code' => deriveStationCode($row['origin'] ?? '', $row['origin_code'] ?? null),
        'dest_code' => deriveStationCode($row['dest'] ?? '', $row['dest_code'] ?? null),
        'departure' => isset($row['depart_time']) ? formatTimeForOutput((string) $row['depart_time']) : '',
        'arrival' => isset($row['arrival_time']) ? formatTimeForOutput((string) $row['arrival_time']) : '',
        'price' => formatPriceForOutput($priceValue),
        'datee' => $row['service_date'] ?? '',
        'available_ticket' => $availableRaw !== null ? max((int) $availableRaw, 0) : -1,
        'total_ticket' => $totalRaw !== null ? max((int) $totalRaw, 0) : null
    ];
}

function deriveStationCode(string $stationName, ?string $explicitCode = null): string
{
    $code = strtoupper(trim((string) $explicitCode));

    if ($code !== '') {
        return $code;
    }

    $name = trim($stationName);

    if ($name === '') {
        return '';
    }

    if (preg_match('/\(([A-Za-z0-9]{2,})\)\s*$/', $name, $matches) === 1) {
        return strtoupper($matches[1]);
    }

    $alphanumeric = preg_replace('/[^A-Za-z0-9]/', '', $name);

    if ($alphanumeric === '') {
        return '';
    }

    return strtoupper(substr($alphanumeric, 0, min(4, strlen($alphanumeric))));
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

function detectColumn(mysqli $conn, string $table, array $columns): ?string
{
    foreach ($columns as $column) {
        if ($column === null || $column === '') {
            continue;
        }

        try {
            $conn->query(sprintf('SELECT %s FROM %s LIMIT 0', quoteIdentifier($column), quoteIdentifier($table)));
            return $column;
        } catch (mysqli_sql_exception $exception) {
            continue;
        }
    }

    return null;
}

function detectExistingTable(mysqli $conn, array $tables): ?string
{
    foreach ($tables as $table) {
        if (tableExists($conn, $table)) {
            return $table;
        }
    }

    return null;
}

function tableExists(mysqli $conn, string $table): bool
{
    try {
        $conn->query('SELECT 1 FROM ' . quoteIdentifier($table) . ' LIMIT 0');
        return true;
    } catch (mysqli_sql_exception $exception) {
        return false;
    }
}

function tableHasColumns(mysqli $conn, string $table, array $columns): bool
{
    if (!tableExists($conn, $table)) {
        return false;
    }

    foreach ($columns as $column) {
        if ($column === null || $column === '') {
            continue;
        }

        try {
            $conn->query(sprintf('SELECT %s FROM %s LIMIT 0', quoteIdentifier($column), quoteIdentifier($table)));
        } catch (mysqli_sql_exception $exception) {
            return false;
        }
    }

    return true;
}

function quoteIdentifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function qualifyColumn(string $alias, string $column): string
{
    return $alias . '.' . quoteIdentifier($column);
}

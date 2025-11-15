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

$monthRaw = isset($_GET['month']) ? trim((string) $_GET['month']) : '';
$yearRaw = isset($_GET['year']) ? trim((string) $_GET['year']) : '';

$hasExplicitMonth = $monthRaw !== '';
$hasExplicitYear = $yearRaw !== '';

if ($hasExplicitMonth && !preg_match('/^\d{1,2}$/', $monthRaw)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid month requested.']);
    exit;
}

if ($hasExplicitYear && !preg_match('/^\d{4}$/', $yearRaw)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid year requested.']);
    exit;
}

$month = $hasExplicitMonth ? (int) $monthRaw : null;
$year = $hasExplicitYear ? (int) $yearRaw : null;

$now = new DateTimeImmutable('now');

if ($month === null) {
    $month = (int) $now->format('n');
}

if ($year === null) {
    $year = (int) $now->format('Y');
}

if ($month < 1 || $month > 12) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid month requested.']);
    exit;
}

if ($year < 1970 || $year > 2100) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid year requested.']);
    exit;
}

$conn = get_db_connection();

try {
    $usageTable = detectExistingTable($conn, ['ticket_usage_log']);

    if ($usageTable === null) {
        $filters = buildHistoryFilters([], $month, $year);
        echo json_encode([
            'status' => 'success',
            'history' => [],
            'filters' => $filters,
        ]);
        return;
    }

    $schema = determineBookingSchema($conn);

    $periods = fetchUsagePeriods($conn, $usageTable, $staffId);

    if (!$hasExplicitYear && !$hasExplicitMonth && !empty($periods)) {
        $month = (int) $periods[0]['month'];
        $year = (int) $periods[0]['year'];
    } elseif ($hasExplicitYear && !$hasExplicitMonth) {
        foreach ($periods as $period) {
            if ((int) $period['year'] === $year) {
                $month = (int) $period['month'];
                break;
            }
        }
    }

    $history = fetchStaffUsageHistory($conn, $schema, $usageTable, $staffId, $month, $year);
    $filters = buildHistoryFilters($periods, $month, $year);

    echo json_encode([
        'status' => 'success',
        'history' => $history,
        'filters' => $filters,
    ]);
} catch (InvalidArgumentException $exception) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('staffHistory error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Unable to load staff history.']);
} finally {
    $conn->close();
}

function fetchUsagePeriods(mysqli $conn, string $usageTable, int $staffId): array
{
    $sql = 'SELECT YEAR(' . quoteIdentifier('used_at') . ') AS year, '
        . 'MONTH(' . quoteIdentifier('used_at') . ') AS month, '
        . 'COUNT(*) AS total '
        . 'FROM ' . quoteIdentifier($usageTable) . ' '
        . 'WHERE ' . quoteIdentifier('staff_user_id') . ' = ? '
        . 'GROUP BY year, month '
        . 'ORDER BY year DESC, month DESC';

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $staffId);
    $stmt->execute();
    $result = $stmt->get_result();

    $periods = [];
    while ($row = $result->fetch_assoc()) {
        $periods[] = [
            'year' => isset($row['year']) ? (int) $row['year'] : null,
            'month' => isset($row['month']) ? (int) $row['month'] : null,
            'count' => isset($row['total']) ? (int) $row['total'] : 0,
        ];
    }

    $stmt->close();

    return $periods;
}

function buildHistoryFilters(array $periods, int $month, int $year): array
{
    $years = [];
    foreach ($periods as $period) {
        $periodYear = isset($period['year']) ? (int) $period['year'] : null;
        if ($periodYear !== null && !in_array($periodYear, $years, true)) {
            $years[] = $periodYear;
        }
    }

    if (!in_array($year, $years, true)) {
        $years[] = $year;
    }

    rsort($years, SORT_NUMERIC);

    $normalizedPeriods = [];
    foreach ($periods as $period) {
        if (!isset($period['year'], $period['month'])) {
            continue;
        }

        $normalizedPeriods[] = [
            'year' => (int) $period['year'],
            'month' => (int) $period['month'],
            'count' => isset($period['count']) ? (int) $period['count'] : 0,
        ];
    }

    return [
        'selected' => [
            'month' => $month,
            'year' => $year,
        ],
        'available' => [
            'years' => $years,
        ],
        'periods' => $normalizedPeriods,
    ];
}

function fetchStaffUsageHistory(
    mysqli $conn,
    array $schema,
    string $usageTable,
    int $staffId,
    int $month,
    int $year
): array {
    if ($schema['variant'] === 'relational') {
        return fetchRelationalStaffUsageHistory($conn, $schema, $usageTable, $staffId, $month, $year);
    }

    return fetchLegacyStaffUsageHistory($conn, $schema, $usageTable, $staffId, $month, $year);
}

function fetchRelationalStaffUsageHistory(
    mysqli $conn,
    array $schema,
    string $usageTable,
    int $staffId,
    int $month,
    int $year
): array {
    $columns = [
        'log.' . quoteIdentifier('usage_id') . ' AS usage_id',
        'log.' . quoteIdentifier('ticket_id') . ' AS log_ticket_id',
        'log.' . quoteIdentifier('result') . ' AS result',
        'log.' . quoteIdentifier('note') . ' AS usage_note',
        'log.' . quoteIdentifier('used_at') . ' AS processed_at',
        qualifyColumn('t', $schema['ticket_id_column']) . ' AS ticket_id',
        qualifyColumn('t', $schema['ticket_status_column']) . ' AS ticket_status',
        qualifyColumn('t', $schema['ticket_customer_fk_column']) . ' AS customer_id',
        qualifyColumn('u', $schema['user_name_column']) . ' AS username',
        'DATE(' . qualifyColumn('s', $schema['service_depart_column']) . ') AS travel_date',
        'TIME(' . qualifyColumn('s', $schema['service_depart_column']) . ') AS depart_time',
        'TIME(' . qualifyColumn('s', $schema['service_arrival_column']) . ') AS arrival_time',
        qualifyColumn('origin', $schema['station_name_column']) . ' AS origin_name',
        qualifyColumn('dest', $schema['station_name_column']) . ' AS dest_name',
    ];

    if ($schema['station_code_column'] !== null) {
        $columns[] = qualifyColumn('origin', $schema['station_code_column']) . ' AS origin_code';
        $columns[] = qualifyColumn('dest', $schema['station_code_column']) . ' AS dest_code';
    } else {
        $columns[] = 'NULL AS origin_code';
        $columns[] = 'NULL AS dest_code';
    }

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
        $columns[] = qualifyColumn('t', $schema['ticket_issued_at_column']) . ' AS ticket_issued_at';
    } else {
        $columns[] = 'NULL AS ticket_issued_at';
    }

    if ($schema['ticket_used_at_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_used_at_column']) . ' AS ticket_used_at';
    } else {
        $columns[] = 'NULL AS ticket_used_at';
    }

    if ($schema['ticket_cancelled_at_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_cancelled_at_column']) . ' AS ticket_cancelled_at';
    } else {
        $columns[] = 'NULL AS ticket_cancelled_at';
    }

    if ($schema['ticket_cancel_reason_column'] !== null) {
        $columns[] = qualifyColumn('t', $schema['ticket_cancel_reason_column']) . ' AS ticket_cancel_reason';
    } else {
        $columns[] = 'NULL AS ticket_cancel_reason';
    }

    $sql = 'SELECT ' . implode(', ', $columns)
        . ' FROM ' . quoteIdentifier($usageTable) . ' AS log'
        . ' INNER JOIN ' . quoteIdentifier($schema['tickets_table']) . ' AS t ON '
        . 'log.' . quoteIdentifier('ticket_id') . ' = ' . qualifyColumn('t', $schema['ticket_id_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['user_table']) . ' AS u ON '
        . qualifyColumn('u', $schema['user_id_column']) . ' = ' . qualifyColumn('t', $schema['ticket_customer_fk_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('s', $schema['service_id_column']) . ' = ' . qualifyColumn('t', $schema['ticket_service_fk_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['service_route_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS origin ON '
        . qualifyColumn('origin', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['origin_station_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['station_table']) . ' AS dest ON '
        . qualifyColumn('dest', $schema['station_id_column']) . ' = ' . qualifyColumn('r', $schema['dest_station_column'])
        . ' WHERE log.' . quoteIdentifier('staff_user_id') . ' = ?'
        . ' AND MONTH(log.' . quoteIdentifier('used_at') . ') = ?'
        . ' AND YEAR(log.' . quoteIdentifier('used_at') . ') = ?';

    if ($schema['ticket_deleted_column'] !== null) {
        $sql .= ' AND ' . qualifyColumn('t', $schema['ticket_deleted_column']) . ' IS NULL';
    }

    $sql .= ' ORDER BY log.' . quoteIdentifier('used_at') . ' DESC, log.' . quoteIdentifier('usage_id') . ' DESC';

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('iii', $staffId, $month, $year);
    $stmt->execute();

    $result = $stmt->get_result();
    $history = [];

    while ($row = $result->fetch_assoc()) {
        $origin = buildStationLabel((string) ($row['origin_name'] ?? ''), $row['origin_code'] ?? null);
        $destination = buildStationLabel((string) ($row['dest_name'] ?? ''), $row['dest_code'] ?? null);

        $unitPrice = $row['unit_price'] ?? null;
        if ($unitPrice === null || $unitPrice === '') {
            $unitPrice = $row['base_price'] ?? null;
        }

        $price = $unitPrice !== null ? formatPriceForOutput((string) $unitPrice) : null;
        $processedAt = $row['processed_at'] ?? null;

        $history[] = [
            'usage_id' => isset($row['usage_id']) ? (int) $row['usage_id'] : null,
            'ticket_id' => isset($row['log_ticket_id']) ? (int) $row['log_ticket_id'] : null,
            'result' => $row['result'] ?? null,
            'note' => $row['usage_note'] ?? null,
            'used_at' => formatDateTimeIso($processedAt),
            'used_at_iso' => formatDateTimeIso($processedAt),
            'ticket' => [
                'ticket_id' => isset($row['ticket_id']) ? (int) $row['ticket_id'] : null,
                'status' => $row['ticket_status'] ?? null,
                'user_id' => isset($row['customer_id']) ? (int) $row['customer_id'] : null,
                'username' => $row['username'] ?? null,
                'origin' => $origin ?: null,
                'destination' => $destination ?: null,
                'travel_date' => $row['travel_date'] ?? null,
                'departure_time' => $row['depart_time'] ?? null,
                'arrival_time' => $row['arrival_time'] ?? null,
                'price' => $price,
                'quantity' => 1,
                'issued_at' => formatDateTimeIso($row['ticket_issued_at'] ?? null),
                'used_at' => formatDateTimeIso($row['ticket_used_at'] ?? null),
                'cancelled_at' => formatDateTimeIso($row['ticket_cancelled_at'] ?? null),
                'cancel_reason' => $row['ticket_cancel_reason'] ?? null,
            ],
        ];
    }

    $stmt->close();

    return $history;
}

function fetchLegacyStaffUsageHistory(
    mysqli $conn,
    array $schema,
    string $usageTable,
    int $staffId,
    int $month,
    int $year
): array {
    $columns = [
        'log.' . quoteIdentifier('usage_id') . ' AS usage_id',
        'log.' . quoteIdentifier('ticket_id') . ' AS log_ticket_id',
        'log.' . quoteIdentifier('result') . ' AS result',
        'log.' . quoteIdentifier('note') . ' AS usage_note',
        'log.' . quoteIdentifier('used_at') . ' AS processed_at',
        qualifyColumn('pt', $schema['ticket_id_column']) . ' AS ticket_id',
        qualifyColumn('pt', $schema['ticket_status_column']) . ' AS ticket_status',
        qualifyColumn('pt', $schema['ticket_user_column']) . ' AS customer_id',
        qualifyColumn('u', $schema['user_name_column']) . ' AS username',
        qualifyColumn('pt', $schema['ticket_quantity_column']) . ' AS quantity',
        qualifyColumn('pt', $schema['ticket_created_column']) . ' AS ticket_issued_at',
        $schema['ticket_cancelled_at_column'] !== null
            ? qualifyColumn('pt', $schema['ticket_cancelled_at_column']) . ' AS ticket_cancelled_at'
            : 'NULL AS ticket_cancelled_at',
        $schema['ticket_cancel_reason_column'] !== null
            ? qualifyColumn('pt', $schema['ticket_cancel_reason_column']) . ' AS ticket_cancel_reason'
            : 'NULL AS ticket_cancel_reason',
        qualifyColumn('s', $schema['service_id_column']) . ' AS service_id',
        qualifyColumn('s', $schema['service_date_column']) . ' AS travel_date',
        qualifyColumn('r', $schema['route_depart_column']) . ' AS depart_time',
        qualifyColumn('r', $schema['route_arrival_column']) . ' AS arrival_time',
        qualifyColumn('r', $schema['route_origin_column']) . ' AS origin_name',
        qualifyColumn('r', $schema['route_dest_column']) . ' AS dest_name',
        $schema['route_price_column'] !== null
            ? qualifyColumn('r', $schema['route_price_column']) . ' AS base_price'
            : 'NULL AS base_price',
    ];

    $sql = 'SELECT ' . implode(', ', $columns)
        . ' FROM ' . quoteIdentifier($usageTable) . ' AS log'
        . ' INNER JOIN ' . quoteIdentifier($schema['ticket_table']) . ' AS pt ON '
        . 'log.' . quoteIdentifier('ticket_id') . ' = ' . qualifyColumn('pt', $schema['ticket_id_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['user_table']) . ' AS u ON '
        . qualifyColumn('u', $schema['user_id_column']) . ' = ' . qualifyColumn('pt', $schema['ticket_user_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['service_table']) . ' AS s ON '
        . qualifyColumn('s', $schema['service_id_column']) . ' = ' . qualifyColumn('pt', $schema['ticket_service_column'])
        . ' INNER JOIN ' . quoteIdentifier($schema['route_table']) . ' AS r ON '
        . qualifyColumn('r', $schema['route_pk_column']) . ' = ' . qualifyColumn('s', $schema['service_route_column'])
        . ' WHERE log.' . quoteIdentifier('staff_user_id') . ' = ?'
        . ' AND MONTH(log.' . quoteIdentifier('used_at') . ') = ?'
        . ' AND YEAR(log.' . quoteIdentifier('used_at') . ') = ?';

    $sql .= ' ORDER BY log.' . quoteIdentifier('used_at') . ' DESC, log.' . quoteIdentifier('usage_id') . ' DESC';

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('iii', $staffId, $month, $year);
    $stmt->execute();

    $result = $stmt->get_result();
    $history = [];

    while ($row = $result->fetch_assoc()) {
        $origin = buildStationLabel((string) ($row['origin_name'] ?? ''), null);
        $destination = buildStationLabel((string) ($row['dest_name'] ?? ''), null);

        $price = $row['base_price'] !== null ? formatPriceForOutput((string) $row['base_price']) : null;
        $processedAt = $row['processed_at'] ?? null;

        $history[] = [
            'usage_id' => isset($row['usage_id']) ? (int) $row['usage_id'] : null,
            'ticket_id' => isset($row['log_ticket_id']) ? (int) $row['log_ticket_id'] : null,
            'result' => $row['result'] ?? null,
            'note' => $row['usage_note'] ?? null,
            'used_at' => formatDateTimeIso($processedAt),
            'used_at_iso' => formatDateTimeIso($processedAt),
            'ticket' => [
                'ticket_id' => isset($row['ticket_id']) ? (int) $row['ticket_id'] : null,
                'status' => $row['ticket_status'] ?? null,
                'user_id' => isset($row['customer_id']) ? (int) $row['customer_id'] : null,
                'username' => $row['username'] ?? null,
                'origin' => $origin ?: null,
                'destination' => $destination ?: null,
                'travel_date' => $row['travel_date'] ?? null,
                'departure_time' => $row['depart_time'] ?? null,
                'arrival_time' => $row['arrival_time'] ?? null,
                'price' => $price,
                'quantity' => isset($row['quantity']) ? (int) $row['quantity'] : null,
                'issued_at' => formatDateTimeIso($row['ticket_issued_at'] ?? null),
                'used_at' => null,
                'cancelled_at' => formatDateTimeIso($row['ticket_cancelled_at'] ?? null),
                'cancel_reason' => $row['ticket_cancel_reason'] ?? null,
            ],
        ];
    }

    $stmt->close();

    return $history;
}

function formatDateTimeIso($value): ?string
{
    if ($value === null || $value === '') {
        return null;
    }

    try {
        $dateTime = new DateTimeImmutable((string) $value);
        return $dateTime->format(DATE_ATOM);
    } catch (Throwable $exception) {
        return is_string($value) ? $value : null;
    }
}

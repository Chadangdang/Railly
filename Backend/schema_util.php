<?php
declare(strict_types=1);

function determineBookingSchema(mysqli $conn): array
{
    $ticketsTable = detectExistingTable($conn, ['tickets']);
    $paidTicketTable = detectExistingTable($conn, ['paid_ticket']);

    if ($ticketsTable !== null) {
        $userTable = detectExistingTable($conn, ['customers', 'user']);
        $serviceTable = detectExistingTable($conn, ['services', 'service']);
        $routeTable = detectExistingTable($conn, ['routes', 'route']);
        $stationTable = detectExistingTable($conn, ['stations', 'station']);
        $ordersTable = detectExistingTable($conn, ['orders']);

        if ($userTable === null || $serviceTable === null || $routeTable === null || $stationTable === null || $ordersTable === null) {
            throw new RuntimeException('Relational booking schema is incomplete.');
        }

        $serviceAvailableColumn = detectColumn($conn, $serviceTable, ['available', 'available_ticket', 'available_tickets']);
        $serviceCapacityColumn = detectColumn($conn, $serviceTable, ['capacity', 'total_ticket', 'available']);
        if ($serviceCapacityColumn === null) {
            $serviceCapacityColumn = $serviceAvailableColumn;
        }

        $schema = [
            'variant' => 'relational',
            'user_table' => $userTable,
            'user_id_column' => detectColumn($conn, $userTable, ['customer_id', 'user_id', 'id']),
            'user_name_column' => detectColumn($conn, $userTable, ['username']),
            'service_table' => $serviceTable,
            'service_id_column' => detectColumn($conn, $serviceTable, ['service_id', 'id']),
            'service_route_column' => detectColumn($conn, $serviceTable, ['route_id']),
            'service_depart_column' => detectColumn($conn, $serviceTable, ['depart_at', 'depart_time']),
            'service_arrival_column' => detectColumn($conn, $serviceTable, ['arrive_at', 'arrival_at', 'arrival_time']),
            'service_capacity_column' => $serviceCapacityColumn,
            'service_available_column' => $serviceAvailableColumn,
            'route_table' => $routeTable,
            'route_pk_column' => detectColumn($conn, $routeTable, ['route_id', 'id']),
            'route_price_column' => detectColumn($conn, $routeTable, ['base_price', 'price_thb', 'price']),
            'origin_station_column' => detectColumn($conn, $routeTable, ['origin_station_id']),
            'dest_station_column' => detectColumn($conn, $routeTable, ['dest_station_id']),
            'station_table' => $stationTable,
            'station_id_column' => detectColumn($conn, $stationTable, ['station_id', 'id']),
            'station_name_column' => detectColumn($conn, $stationTable, ['name', 'station_name']),
            'station_code_column' => detectColumn($conn, $stationTable, ['code', 'station_code']),
            'orders_table' => $ordersTable,
            'orders_customer_column' => detectColumn($conn, $ordersTable, ['customer_id', 'user_id']),
            'orders_total_unit_column' => detectColumn($conn, $ordersTable, ['total_unit', 'quantity']),
            'orders_total_amount_column' => detectColumn($conn, $ordersTable, ['total_amount', 'amount']),
            'orders_paid_at_column' => detectColumn($conn, $ordersTable, ['paid_at']),
            'tickets_table' => $ticketsTable,
            'ticket_order_fk_column' => detectColumn($conn, $ticketsTable, ['order_id']),
            'ticket_customer_fk_column' => detectColumn($conn, $ticketsTable, ['customer_id', 'user_id']),
            'ticket_service_fk_column' => detectColumn($conn, $ticketsTable, ['service_id']),
            'ticket_unit_price_column' => detectColumn($conn, $ticketsTable, ['unit_price', 'price']),
            'ticket_status_column' => detectColumn($conn, $ticketsTable, ['status']),
            'ticket_id_column' => detectColumn($conn, $ticketsTable, ['ticket_id', 'id']),
            'ticket_issued_at_column' => detectColumn($conn, $ticketsTable, ['issued_at', 'created_at']),
            'ticket_cancelled_at_column' => detectColumn($conn, $ticketsTable, ['cancelled_at']),
            'ticket_deleted_column' => detectColumn($conn, $ticketsTable, ['deleted_at']),
        ];

        foreach ([
            'user_id_column',
            'user_name_column',
            'service_id_column',
            'service_route_column',
            'service_depart_column',
            'service_arrival_column',
            'service_capacity_column',
            'route_pk_column',
            'origin_station_column',
            'dest_station_column',
            'station_id_column',
            'station_name_column',
            'orders_customer_column',
            'ticket_order_fk_column',
            'ticket_customer_fk_column',
            'ticket_service_fk_column',
            'ticket_unit_price_column',
            'ticket_status_column',
            'ticket_id_column',
        ] as $required) {
            if ($schema[$required] === null) {
                throw new RuntimeException('Relational booking schema missing required column: ' . $required);
            }
        }

        return $schema;
    }

    if ($paidTicketTable !== null) {
        $userTable = detectExistingTable($conn, ['user', 'customers']);
        $serviceTable = detectExistingTable($conn, ['service', 'services']);
        $routeTable = detectExistingTable($conn, ['route', 'routes']);

        if ($userTable === null || $serviceTable === null || $routeTable === null) {
            throw new RuntimeException('Legacy booking schema is incomplete.');
        }

        $schema = [
            'variant' => 'legacy',
            'user_table' => $userTable,
            'user_id_column' => detectColumn($conn, $userTable, ['user_id', 'customer_id', 'id']),
            'user_name_column' => detectColumn($conn, $userTable, ['username']),
            'service_table' => $serviceTable,
            'service_id_column' => detectColumn($conn, $serviceTable, ['service_id', 'id']),
            'service_route_column' => detectColumn($conn, $serviceTable, ['route_id']),
            'service_available_column' => detectColumn($conn, $serviceTable, ['available_ticket', 'available_tickets', 'remaining_ticket']),
            'service_date_column' => detectColumn($conn, $serviceTable, ['service_date', 'datee']),
            'route_table' => $routeTable,
            'route_pk_column' => detectColumn($conn, $routeTable, ['route_id', 'id']),
            'route_origin_column' => detectColumn($conn, $routeTable, ['origin', 'origin_station']),
            'route_dest_column' => detectColumn($conn, $routeTable, ['dest', 'destination', 'dest_station']),
            'route_depart_column' => detectColumn($conn, $routeTable, ['depart_time', 'departure_time']),
            'route_arrival_column' => detectColumn($conn, $routeTable, ['arrival_time', 'arrive_time']),
            'route_price_column' => detectColumn($conn, $routeTable, ['price_thb', 'price']),
            'ticket_table' => $paidTicketTable,
            'ticket_user_column' => detectColumn($conn, $paidTicketTable, ['user_id', 'customer_id']),
            'ticket_service_column' => detectColumn($conn, $paidTicketTable, ['service_id']),
            'ticket_quantity_column' => detectColumn($conn, $paidTicketTable, ['quantity', 'total']),
            'ticket_status_column' => detectColumn($conn, $paidTicketTable, ['status']),
            'ticket_created_column' => detectColumn($conn, $paidTicketTable, ['created_at', 'issued_at']),
            'ticket_cancelled_at_column' => detectColumn($conn, $paidTicketTable, ['cancelled_at']),
            'ticket_id_column' => detectColumn($conn, $paidTicketTable, ['ticket_id', 'id']),
        ];

        foreach ([
            'user_id_column',
            'user_name_column',
            'service_id_column',
            'service_route_column',
            'service_available_column',
            'service_date_column',
            'route_origin_column',
            'route_dest_column',
            'route_depart_column',
            'route_arrival_column',
            'ticket_user_column',
            'ticket_service_column',
            'ticket_quantity_column',
            'ticket_status_column',
            'ticket_created_column',
            'ticket_id_column',
        ] as $required) {
            if ($schema[$required] === null) {
                throw new RuntimeException('Legacy booking schema missing required column: ' . $required);
            }
        }

        if ($schema['route_price_column'] === null) {
            $schema['route_price_column'] = 'price_thb';
        }

        return $schema;
    }

    throw new RuntimeException('Unsupported booking schema.');
}

function fetchValidatedUser(
    mysqli $conn,
    string $userTable,
    string $userIdColumn,
    string $usernameColumn,
    int $userId,
    string $username
): array {
    $sql = sprintf(
        'SELECT %s FROM %s WHERE %s = ? LIMIT 1',
        quoteIdentifier($usernameColumn),
        quoteIdentifier($userTable),
        quoteIdentifier($userIdColumn)
    );

    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $userId);
    $stmt->execute();

    $result = $stmt->get_result();
    if ($result->num_rows === 0) {
        $stmt->close();
        throw new InvalidArgumentException('User not found.');
    }

    $row = $result->fetch_assoc();
    $stmt->close();

    if (strcasecmp((string) $row[$usernameColumn], $username) !== 0) {
        throw new InvalidArgumentException('User information does not match.');
    }

    return $row;
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

function buildStationLabel(string $name, ?string $code): string
{
    $trimmedName = trim($name);
    $trimmedCode = $code !== null ? strtoupper(trim($code)) : '';

    if ($trimmedName === '') {
        return $trimmedCode !== '' ? $trimmedCode : '';
    }

    if ($trimmedCode === '') {
        return $trimmedName;
    }

    return sprintf('%s (%s)', $trimmedName, $trimmedCode);
}

function detectExistingTable(mysqli $conn, array $tables): ?string
{
    foreach ($tables as $table) {
        if ($table === null || $table === '') {
            continue;
        }

        if (tableExists($conn, $table)) {
            return $table;
        }
    }

    return null;
}

function detectColumn(mysqli $conn, string $table, array $candidates): ?string
{
    foreach ($candidates as $column) {
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

function tableExists(mysqli $conn, string $table): bool
{
    try {
        $conn->query('SELECT 1 FROM ' . quoteIdentifier($table) . ' LIMIT 0');
        return true;
    } catch (mysqli_sql_exception $exception) {
        return false;
    }
}

function quoteIdentifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

function qualifyColumn(string $alias, string $column): string
{
    return $alias . '.' . quoteIdentifier($column);
}

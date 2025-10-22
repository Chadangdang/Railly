<?php
declare(strict_types=1);

header('Content-Type: application/json');

require_once __DIR__ . '/db_connection.php';

$conn = get_db_connection();

try {
    $stations = fetchStations($conn);

    if (empty($stations)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'No stations available. Please seed the stations table.'
        ]);
        return;
    }

    echo json_encode($stations);
} catch (mysqli_sql_exception $exception) {
    error_log('getStations error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Failed to retrieve stations.'
    ]);
} finally {
    $conn->close();
}

function fetchStations(mysqli $conn): array
{
    $strategies = [
        [
            'table' => 'stations',
            'id_column' => 'station_id',
            'name_column' => 'name',
            'code_column' => 'code',
            'filter' => 'deleted_at IS NULL'
        ],
        [
            'table' => 'station',
            'id_column' => 'station_id',
            'name_column' => 'station_name',
            'code_column' => 'station_code',
            'filter' => null
        ]
    ];

    foreach ($strategies as $strategy) {
        $query = buildStationQuery($strategy);

        if ($query === null) {
            continue;
        }

        try {
            $result = $conn->query($query);
        } catch (mysqli_sql_exception $exception) {
            continue;
        }

        if ($result === false) {
            continue;
        }

        $stations = [];

        while ($row = $result->fetch_assoc()) {
            $stations[] = [
                'id' => isset($row['id']) ? (int) $row['id'] : null,
                'name' => $row['name'] ?? null,
                'code' => $row['code'] ?? null
            ];
        }

        $result->free();

        if (!empty($stations)) {
            return $stations;
        }
    }

    return fetchStationsFromRoutes($conn);
}

function buildStationQuery(array $strategy): ?string
{
    if (empty($strategy['table']) || empty($strategy['name_column'])) {
        return null;
    }

    $columns = [
        sprintf('%s AS id', $strategy['id_column'] ?? 'NULL'),
        sprintf('%s AS name', $strategy['name_column']),
        sprintf('%s AS code', $strategy['code_column'] ?? 'NULL')
    ];

    $query = sprintf('SELECT %s FROM %s', implode(', ', $columns), $strategy['table']);

    if (!empty($strategy['filter'])) {
        $query .= ' WHERE ' . $strategy['filter'];
    }

    $query .= ' ORDER BY name ASC';

    return $query;
}

function fetchStationsFromRoutes(mysqli $conn): array
{
    $routeTables = ['route', 'routes'];

    foreach ($routeTables as $routeTable) {
        $query = sprintf(
            'SELECT DISTINCT origin AS station_name FROM %1$s UNION SELECT DISTINCT dest AS station_name FROM %1$s ORDER BY station_name',
            $routeTable
        );

        try {
            $result = $conn->query($query);
        } catch (mysqli_sql_exception $exception) {
            continue;
        }

        if ($result === false) {
            continue;
        }

        $stations = [];

        while ($row = $result->fetch_assoc()) {
            if (!empty($row['station_name'])) {
                $stations[] = [
                    'id' => null,
                    'name' => $row['station_name'],
                    'code' => null
                ];
            }
        }

        $result->free();

        if (!empty($stations)) {
            return $stations;
        }
    }

    return [];
}
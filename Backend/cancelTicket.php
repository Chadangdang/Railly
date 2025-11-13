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

$ticketIdRaw = isset($_POST['ticket_id']) ? trim((string) $_POST['ticket_id']) : '';
$username = isset($_POST['username']) ? trim((string) $_POST['username']) : '';
$userIdRaw = isset($_POST['id']) ? trim((string) $_POST['id']) : '';

if ($ticketIdRaw === '' || $username === '' || $userIdRaw === '') {
    echo json_encode(['status' => 'error', 'message' => 'Missing required parameters.']);
    exit;
}

$ticketId = (int) $ticketIdRaw;
$userId = (int) $userIdRaw;

if ($ticketId <= 0 || $userId <= 0) {
    echo json_encode(['status' => 'error', 'message' => 'Invalid ticket or user information provided.']);
    exit;
}

$conn = get_db_connection();

try {
    $schema = determineBookingSchema($conn);

    if ($schema['variant'] === 'relational') {
        $result = cancelRelationalTicket($conn, $schema, $ticketId, $userId, $username);
    } else {
        $result = cancelLegacyTicket($conn, $schema, $ticketId, $userId, $username);
    }

    $response = [
        'status' => 'success',
        'message' => $result['message'],
        'ticket' => $result['ticket'],
        'restored_quantity' => $result['restored_quantity'],
    ];

    if (array_key_exists('available_tickets', $result) && $result['available_tickets'] !== null) {
        $response['available_tickets'] = $result['available_tickets'];
    }

    echo json_encode($response);
} catch (InvalidArgumentException $exception) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_log('cancelTicket error: ' . $exception->getMessage());
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Failed to cancel the ticket.']);
} finally {
    $conn->close();
}

function cancelRelationalTicket(mysqli $conn, array $schema, int $ticketId, int $userId, string $username): array
{
    fetchValidatedUser(
        $conn,
        $schema['user_table'],
        $schema['user_id_column'],
        $schema['user_name_column'],
        $userId,
        $username
    );

    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $ticketRow = fetchRelationalTicketForUpdate($conn, $schema, $ticketId, $userId);

        if (!isset($ticketRow['status']) || strcasecmp((string) $ticketRow['status'], 'PAID') !== 0) {
            throw new InvalidArgumentException('Only paid tickets can be cancelled.');
        }

        $serviceId = isset($ticketRow['service_id']) ? (int) $ticketRow['service_id'] : 0;
        if ($serviceId <= 0) {
            throw new InvalidArgumentException('Related service could not be found for this ticket.');
        }

        $cancelledStatus = 'CANCELLED';
        $cancelTimestamp = null;
        $setClauses = [quoteIdentifier($schema['ticket_status_column']) . ' = ?'];

        if ($schema['ticket_cancelled_at_column'] !== null) {
            $cancelTimestamp = date('Y-m-d H:i:s');
            $setClauses[] = quoteIdentifier($schema['ticket_cancelled_at_column']) . ' = ?';
        }

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
        if ($cancelTimestamp !== null) {
            $updateStmt->bind_param('ssii', $cancelledStatus, $cancelTimestamp, $ticketId, $userId);
        } else {
            $updateStmt->bind_param('sii', $cancelledStatus, $ticketId, $userId);
        }
        $updateStmt->execute();
        $updateStmt->close();

        $restoredQuantity = 1;
        $availableTickets = null;

        if ($schema['service_available_column'] !== null) {
            $serviceRow = fetchRelationalServiceAvailabilityForUpdate($conn, $schema, $serviceId);

            $available = isset($serviceRow['available']) ? (int) $serviceRow['available'] : 0;
            $capacity = isset($serviceRow['capacity']) && $serviceRow['capacity'] !== null
                ? (int) $serviceRow['capacity']
                : null;

            $newAvailable = $available + $restoredQuantity;

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

            $availableTickets = $newAvailable;
        }

        $conn->commit();
        $transactionStarted = false;

        return [
            'message' => 'Ticket cancelled successfully.',
            'ticket' => [
                'ticket_id' => $ticketId,
                'status' => $cancelledStatus,
                'cancelled_at' => $cancelTimestamp,
            ],
            'available_tickets' => $availableTickets,
            'restored_quantity' => $restoredQuantity,
        ];
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function cancelLegacyTicket(mysqli $conn, array $schema, int $ticketId, int $userId, string $username): array
{
    fetchValidatedUser(
        $conn,
        $schema['user_table'],
        $schema['user_id_column'],
        $schema['user_name_column'],
        $userId,
        $username
    );

    $conn->begin_transaction();
    $transactionStarted = true;

    try {
        $ticketRow = fetchLegacyTicketForUpdate($conn, $schema, $ticketId, $userId);

        if (!isset($ticketRow['status']) || strcasecmp((string) $ticketRow['status'], 'PAID') !== 0) {
            throw new InvalidArgumentException('Only paid tickets can be cancelled.');
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
        $cancelTimestamp = null;
        $setClauses = [quoteIdentifier($schema['ticket_status_column']) . ' = ?'];

        if ($schema['ticket_cancelled_at_column'] !== null) {
            $cancelTimestamp = date('Y-m-d H:i:s');
            $setClauses[] = quoteIdentifier($schema['ticket_cancelled_at_column']) . ' = ?';
        }

        $updateSql = sprintf(
            'UPDATE %s SET %s WHERE %s = ? AND %s = ?',
            quoteIdentifier($schema['ticket_table']),
            implode(', ', $setClauses),
            quoteIdentifier($schema['ticket_id_column']),
            quoteIdentifier($schema['ticket_user_column'])
        );

        $updateStmt = $conn->prepare($updateSql);
        if ($cancelTimestamp !== null) {
            $updateStmt->bind_param('ssii', $cancelledStatus, $cancelTimestamp, $ticketId, $userId);
        } else {
            $updateStmt->bind_param('sii', $cancelledStatus, $ticketId, $userId);
        }
        $updateStmt->execute();
        $updateStmt->close();

        $serviceRow = fetchLegacyServiceAvailabilityForUpdate($conn, $schema, $serviceId);
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

        $conn->commit();
        $transactionStarted = false;

        return [
            'message' => 'Ticket cancelled successfully.',
            'ticket' => [
                'ticket_id' => $ticketId,
                'status' => $cancelledStatus,
                'cancelled_at' => $cancelTimestamp,
            ],
            'available_tickets' => $newAvailable,
            'restored_quantity' => $quantity,
        ];
    } finally {
        if ($transactionStarted) {
            $conn->rollback();
        }
    }
}

function fetchRelationalTicketForUpdate(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    $columns = [
        qualifyColumn('t', $schema['ticket_id_column']) . ' AS ticket_id',
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

function fetchRelationalServiceAvailabilityForUpdate(mysqli $conn, array $schema, int $serviceId): array
{
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

function fetchLegacyTicketForUpdate(mysqli $conn, array $schema, int $ticketId, int $userId): array
{
    $columns = [
        qualifyColumn('pt', $schema['ticket_id_column']) . ' AS ticket_id',
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

function fetchLegacyServiceAvailabilityForUpdate(mysqli $conn, array $schema, int $serviceId): array
{
    $sql = sprintf(
        'SELECT %s AS available FROM %s AS s WHERE %s = ? FOR UPDATE',
        qualifyColumn('s', $schema['service_available_column']),
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

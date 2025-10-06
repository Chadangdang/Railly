<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function get_db_connection(): mysqli
{
    $host = getenv('DB_HOST') ?: 'localhost';
    $username = getenv('DB_USER') ?: 'root';
    $password = getenv('DB_PASS') ?: '';
    $database = getenv('DB_NAME') ?: 'railly';

    try {
        $connection = new mysqli($host, $username, $password, $database);
        $connection->set_charset('utf8mb4');
    } catch (mysqli_sql_exception $exception) {
        error_log('Database connection failed: ' . $exception->getMessage());
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Database connection failed.']);
        exit;
    }

    return $connection;
}

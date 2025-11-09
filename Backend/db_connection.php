<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

require_once __DIR__ . '/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->safeLoad();

function get_db_connection(): mysqli
{
    $host = $_ENV['DB_HOST'] ?? '127.0.0.1';
    $username = $_ENV['DB_USER'] ?? 'root';
    $password = $_ENV['DB_PASS'] ?? 'root';
    $database = $_ENV['DB_NAME'] ?? 'railly';
    $port = isset($_ENV['DB_PORT']) ? (int)$_ENV['DB_PORT'] : 8889;

    try {
        $connection = new mysqli($host, $username, $password, $database, $port);
        $connection->set_charset('utf8mb4');
        return $connection;
    } catch (mysqli_sql_exception $e) {
        error_log('Database connection failed: ' . $e->getMessage());

        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'error',
            'message' => 'Database connection failed. Please check your configuration.',
            'error' => $e->getMessage()
        ]);
        exit;
    }
}
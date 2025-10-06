<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function get_db_connection(): mysqli
{
    $host = getenv('DB_HOST') ?: 'localhost';
    $username = getenv('DB_USER') ?: 'root';
    $password = getenv('DB_PASS');
    $database = getenv('DB_NAME') ?: 'railly';
    $port = getenv('DB_PORT');

    $password = $password === false ? '' : $password;
    $port = $port === false ? (int) (ini_get('mysqli.default_port') ?: 3306) : (int) $port;

    $createConnection = static function (string $host, string $username, string $password, string $database, int $port): mysqli {
        $connection = new mysqli($host, $username, $password, $database, $port);
        $connection->set_charset('utf8mb4');

        return $connection;
    };

    try {
        return $createConnection($host, $username, $password, $database, $port);
    } catch (mysqli_sql_exception $exception) {
        $fallbackPassword = 'root';
        $fallbackPort = 8889;

        $shouldAttemptFallback = $password === '';

        if ($shouldAttemptFallback) {
            try {
                error_log('Primary DB connection failed. Attempting fallback connection using common MAMP defaults.');

                return $createConnection($host, $username, $fallbackPassword, $database, $fallbackPort);
            } catch (mysqli_sql_exception $fallbackException) {
                error_log('Fallback DB connection failed: ' . $fallbackException->getMessage());
            }
        }

        error_log('Database connection failed: ' . $exception->getMessage());
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'message' => 'Database connection failed. Please verify your database credentials and configuration.',
        ]);
        exit;
    }
}

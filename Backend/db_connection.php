<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

/**
 * Try to load Composer autoloader + Dotenv if present.
 * Code still works if vendor/ is missing (falls back to defaults).
 */
(function (): void {
    $autoload = __DIR__ . '/vendor/autoload.php';
    if (is_file($autoload)) {
        require_once $autoload;
        if (class_exists(\Dotenv\Dotenv::class)) {
            \Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();
        }
    }
})();

/** Read env from multiple places (Dotenv fills $_ENV/$_SERVER). */
function envx(string $key, ?string $fallback = null): ?string {
    foreach ([$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key) ?: null] as $v) {
        if ($v !== null && $v !== '') return $v;
    }
    return $fallback;
}

/** Configure the default PHP timezone with fallback handling. */
function configure_default_timezone(): void
{
    $timezone = envx('APP_TIMEZONE', 'Asia/Bangkok');

    if ($timezone === null || $timezone === '') {
        $timezone = 'Asia/Bangkok';
    }

    if (!@date_default_timezone_set($timezone)) {
        error_log(sprintf('Invalid APP_TIMEZONE "%s". Falling back to UTC.', (string) $timezone));
        date_default_timezone_set('UTC');
    }
}

configure_default_timezone();

function get_db_connection(): mysqli
{
    $httpHost = $_SERVER['HTTP_HOST'] ?? '';
    $isInfinityFree = strpos($httpHost, 'railly.great-site.net') !== false;

    if ($isInfinityFree) {
        $host = 'sqlXXX.infinityfree.com';
        $user = 'if0_40424884_xxx';
        $pass = 'YOUR_STRONG_DB_PASSWORD_HERE';
        $db   = 'if0_40424884_railly';
        $port = 3306;
    } else {
        $host = envx('DB_HOST', '127.0.0.1');
        $user = envx('DB_USER', 'root');
        $pass = envx('DB_PASS', 'root');
        $db   = envx('DB_NAME', 'railly');
        $port = (int) (envx('DB_PORT') ?? '8889');
    }

    try {
        $conn = new mysqli($host, $user, $pass, $db, $port);
        $conn->set_charset('utf8mb4');

        if (!$conn->ping()) {
            throw new mysqli_sql_exception('Ping failed after connect');
        }

        return $conn;
    } catch (mysqli_sql_exception $e) {
        error_log('DB connect failed: ' . $e->getMessage());

        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }

        $payload = [
            'status'  => 'error',
            'message' => 'Database connection failed.',
        ];

        if (!$isInfinityFree) {
            $payload['details'] = $e->getMessage();
            $payload['using']   = compact('host', 'user', 'db', 'port');
            $payload['hint']    = [
                'Use MAMP defaults or set Backend/.env',
                'Make sure you’re opening http://localhost:8888/… (MAMP port)',
                'Confirm DB "railly" exists in phpMyAdmin',
            ];
        }

        echo json_encode($payload, JSON_UNESCAPED_SLASHES);
        exit;
    }
}
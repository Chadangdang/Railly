<?php
declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

// Railly environment + DB config
$currentHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
$ENV = strpos($currentHost, 'railly.great-site.net') !== false ? 'production' : 'local';

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

// DB configs (KEEP local MAMP config, ADD production InfinityFree)
$dbConfigs = [
    'local' => [
        'host' => envx('DB_HOST', 'localhost'),
        'user' => envx('DB_USER', 'root'),           // MAMP user
        'pass' => envx('DB_PASS', 'root'),           // MAMP password
        'name' => envx('DB_NAME', 'railly'),         // local DB name
        'port' => (int) (envx('DB_PORT') ?? '8889'), // default MAMP port
    ],
    'production' => [
        'host' => 'sql303.infinityfree.com',
        'user' => 'if0_40424884',
        'pass' => 'Railly1234Plus',
        'name' => 'if0_40424884_railly',
        'port' => 3306,
    ],
];

// BASE_URL for links and redirects
if (!defined('BASE_URL')) {
    if ($ENV === 'production') {
        define('BASE_URL', 'https://railly.great-site.net');
    } else {
        // Local MAMP:
        // If the project is directly at http://localhost:8888 → use this:
        define('BASE_URL', 'http://localhost:8888');

        // If instead the project is in a subfolder like http://localhost:8888/railly
        // change to:
        // define('BASE_URL', 'http://localhost:8888/railly');
    }
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
    global $dbConfigs, $ENV;

    $db = $dbConfigs[$ENV] ?? $dbConfigs['local'];

    $host = $db['host'];
    $user = $db['user'];
    $pass = $db['pass'];
    $name = $db['name'];
    $port = $db['port'] ?? 3306;

    $isProduction = $ENV === 'production';

    try {
        $conn = new mysqli($host, $user, $pass, $name, (int) $port);
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

        if (!$isProduction) {
            $payload['details'] = $e->getMessage();
            $payload['using']   = compact('host', 'user', 'name', 'port');
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

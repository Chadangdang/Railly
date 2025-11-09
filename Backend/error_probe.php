<?php
declare(strict_types=1);

// Show everything so we don't get a blank page
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain; charset=utf-8');

echo "=== BASIC CHECKS ===\n";
echo "URL must be http://localhost:8888/Backend/error_probe.php\n\n";

echo "PHP SAPI: " . php_sapi_name() . "\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Document Root: " . ($_SERVER['DOCUMENT_ROOT'] ?? '(unknown)') . "\n";
echo "Script: " . __FILE__ . "\n\n";

// Is mysqli loaded?
echo "mysqli extension loaded? " . (extension_loaded('mysqli') ? 'yes' : 'NO (this would cause 500)') . "\n\n";

// Quick PHP sanity
echo "=== PHP SANITY ===\n";
echo "echo works.\n\n";

// Try a bare-minimum MySQL connect without a DB name first
echo "=== MYSQL CONNECT TESTS ===\n";
$tests = [
  ['label' => 'MAMP default 127.0.0.1:8889 root/root', 'h'=>'127.0.0.1','u'=>'root','p'=>'root','d'=>null,'port'=>8889],
  ['label' => 'Try 127.0.0.1:3306 root/root',           'h'=>'127.0.0.1','u'=>'root','p'=>'root','d'=>null,'port'=>3306],
];

foreach ($tests as $t) {
  echo "-- " . $t['label'] . " --\n";
  try {
    $conn = @new mysqli($t['h'], $t['u'], $t['p'], '', (int)$t['port']);
    if ($conn->connect_errno) {
      echo "CONNECT ERR ({$conn->connect_errno}): {$conn->connect_error}\n\n";
    } else {
      echo "OK: connected to server (no DB selected). host_info={$conn->host_info}\n";
      $res = $conn->query('SELECT VERSION() v');
      if ($res) {
        $row = $res->fetch_assoc();
        echo "MySQL VERSION(): " . ($row['v'] ?? '(unknown)') . "\n";
      }
      $conn->close();
      echo "\n";
    }
  } catch (Throwable $e) {
    echo "PHP FATAL: " . $e->getMessage() . "\n\n";
  }
}

// Now try selecting DB `railly` if server connect was OK on 8889
echo "=== DB SELECT TEST (railly) ===\n";
try {
  $conn = @new mysqli('127.0.0.1', 'root', 'root', 'railly', 8889);
  if ($conn->connect_errno) {
    echo "CONNECT/DB ERR ({$conn->connect_errno}): {$conn->connect_error}\n";
  } else {
    echo "OK: connected and DB 'railly' selected.\n";
    $conn->close();
  }
} catch (Throwable $e) {
  echo "PHP FATAL: " . $e->getMessage() . "\n";
}

echo "\n=== END ===\n";
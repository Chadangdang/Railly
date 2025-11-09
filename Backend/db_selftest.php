<?php
declare(strict_types=1);
header('Content-Type: text/plain; charset=utf-8');

$matrix = [
  ['name'=>'MAMP-127.0.0.1:8889 (root/root)', 'h'=>'127.0.0.1','u'=>'root','p'=>'root','d'=>'railly','port'=>8889],
  ['name'=>'MAMP-localhost:8889 (root/root)',  'h'=>'localhost', 'u'=>'root','p'=>'root','d'=>'railly','port'=>8889],
  ['name'=>'Try 127.0.0.1:3306 (root/root)',   'h'=>'127.0.0.1','u'=>'root','p'=>'root','d'=>'railly','port'=>3306],
  ['name'=>'Try localhost:3306 (root/root)',    'h'=>'localhost', 'u'=>'root','p'=>'root','d'=>'railly','port'=>3306],
];

printf("PHP: %s | mysqli loaded: %s\n\n", PHP_VERSION, extension_loaded('mysqli') ? 'yes' : 'no');

foreach ($matrix as $m) {
  echo "=== ".$m['name']." ===\n";
  try {
    $t0 = microtime(true);
    $conn = new mysqli($m['h'], $m['u'], $m['p'], $m['d'], (int)$m['port']);
    $conn->set_charset('utf8mb4');
    $ok = $conn->ping();
    $ver = $conn->query('SELECT VERSION() v')->fetch_assoc()['v'] ?? '(unknown)';
    printf("OK  host_info=%s | version=%s | %.1f ms\n\n", $conn->host_info, $ver, (microtime(true)-$t0)*1000);
    $conn->close();
  } catch (Throwable $e) {
    echo "ERR ".$e->getMessage()."\n\n";
  }
}

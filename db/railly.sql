-- phpMyAdmin SQL Dump
-- version 5.1.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 19, 2025 at 08:40 PM
-- Server version: 5.7.24
-- PHP Version: 8.3.1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `railly`
--

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `customer_id` bigint(20) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`customer_id`, `username`, `email`, `password_hash`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'C', 'c@gmail.com', '$2y$10$771XLJwEt6HaE7DvGvMb2etoTYGDr9zyTTmL2pG2yY5aQ58K1LHgm', '2025-10-17 19:59:05', '2025-11-14 19:14:00', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` bigint(20) NOT NULL,
  `customer_id` bigint(20) NOT NULL,
  `total_unit` int(11) NOT NULL DEFAULT '0',
  `total_amount` decimal(10,2) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `routes`
--

CREATE TABLE `routes` (
  `route_id` int(11) NOT NULL,
  `origin_station_id` int(11) NOT NULL,
  `dest_station_id` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `base_price` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `routes`
--

INSERT INTO `routes` (`route_id`, `origin_station_id`, `dest_station_id`, `active`, `base_price`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 1, 2, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(2, 1, 3, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(3, 1, 4, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(4, 1, 5, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(5, 1, 6, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(6, 1, 7, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(7, 1, 8, 1, '140.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(8, 1, 9, 1, '160.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(9, 1, 10, 1, '180.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(10, 2, 1, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(11, 2, 3, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(12, 2, 4, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(13, 2, 5, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(14, 2, 6, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(15, 2, 7, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(16, 2, 8, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(17, 2, 9, 1, '140.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(18, 2, 10, 1, '160.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(19, 3, 1, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(20, 3, 2, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(21, 3, 4, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(22, 3, 5, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(23, 3, 6, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(24, 3, 7, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(25, 3, 8, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(26, 3, 9, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(27, 3, 10, 1, '140.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(28, 4, 1, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(29, 4, 2, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(30, 4, 3, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(31, 4, 5, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(32, 4, 6, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(33, 4, 7, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(34, 4, 8, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(35, 4, 9, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(36, 4, 10, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(37, 5, 1, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(38, 5, 2, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(39, 5, 3, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(40, 5, 4, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(41, 5, 6, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(42, 5, 7, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(43, 5, 8, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(44, 5, 9, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(45, 5, 10, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(46, 6, 1, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(47, 6, 2, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(48, 6, 3, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(49, 6, 4, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(50, 6, 5, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(51, 6, 7, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(52, 6, 8, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(53, 6, 9, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(54, 6, 10, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(55, 7, 1, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(56, 7, 2, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(57, 7, 3, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(58, 7, 4, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(59, 7, 5, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(60, 7, 6, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(61, 7, 8, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(62, 7, 9, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(63, 7, 10, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(64, 8, 1, 1, '140.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(65, 8, 2, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(66, 8, 3, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(67, 8, 4, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(68, 8, 5, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(69, 8, 6, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(70, 8, 7, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(71, 8, 9, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(72, 8, 10, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(73, 9, 1, 1, '160.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(74, 9, 2, 1, '140.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(75, 9, 3, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(76, 9, 4, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(77, 9, 5, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(78, 9, 6, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(79, 9, 7, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(80, 9, 8, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(81, 9, 10, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(82, 10, 1, 1, '180.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(83, 10, 2, 1, '160.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(84, 10, 3, 1, '140.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(85, 10, 4, 1, '120.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(86, 10, 5, 1, '100.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(87, 10, 6, 1, '80.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(88, 10, 7, 1, '60.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(89, 10, 8, 1, '40.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL),
(90, 10, 9, 1, '20.00', '2025-10-22 13:35:22', '2025-10-22 13:37:46', NULL);

--
-- Triggers `routes`
--
DELIMITER $$
CREATE TRIGGER `routes_after_update` AFTER UPDATE ON `routes` FOR EACH ROW BEGIN
    IF NEW.active = 1 AND OLD.active = 0 THEN
        UPDATE services
        SET status = 'OPEN'
        WHERE route_id = NEW.route_id;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `service_id` int(11) NOT NULL,
  `route_id` int(11) NOT NULL,
  `depart_at` datetime NOT NULL,
  `arrive_at` datetime DEFAULT NULL,
  `capacity` int(11) NOT NULL,
  `available` int(11) NOT NULL DEFAULT '0',
  `status` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Triggers `services`
--
DELIMITER $$
CREATE TRIGGER `services_after_insert_close` AFTER INSERT ON `services` FOR EACH ROW BEGIN
    DECLARE route_status TINYINT;
    SELECT active INTO route_status
    FROM routes
    WHERE route_id = NEW.route_id;
    IF route_status = 0 THEN
        UPDATE services
        SET status = 'CLOSED'
        WHERE service_id = NEW.service_id;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `services_before_insert_block` BEFORE INSERT ON `services` FOR EACH ROW BEGIN
    -- ประกาศตัวแปร
    DECLARE route_active TINYINT;

    -- ตรวจสอบว่า route active หรือไม่
    SELECT active INTO route_active
    FROM routes
    WHERE route_id = NEW.route_id;

    -- ถ้า inactive ให้ error
    IF route_active = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot create service: route is inactive';
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `staff_users`
--

CREATE TABLE `staff_users` (
  `staff_user_id` bigint(20) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `staff_users`
--

INSERT INTO `staff_users` (`staff_user_id`, `username`, `email`, `password_hash`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'chadang', 'chadang@gmail.com', '$2a$12$O4vn9uzUbK8IWYoV4r8rc.XFfOlDxfZvJHp..kF9oeL7GyFOcYIJS', '2025-11-14 19:00:32', '2025-11-14 20:10:10', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `stations`
--

CREATE TABLE `stations` (
  `station_id` int(11) NOT NULL,
  `code` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Dumping data for table `stations`
--

INSERT INTO `stations` (`station_id`, `code`, `name`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'BKK', 'Bangkok', '2025-10-16 16:01:40', '2025-10-16 16:01:40', NULL),
(2, 'RGT', 'Rangsit', '2025-10-16 16:01:40', '2025-10-16 16:01:40', NULL),
(3, 'AYA', 'Ayutthaya', '2025-10-16 16:01:40', '2025-10-16 16:01:40', NULL),
(4, 'LBR', 'Lop Buri', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL),
(5, 'BMI', 'Ban Mi', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL),
(6, 'BTK', 'Ban Takhli', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL),
(7, 'NKS', 'Nakhon Sawan', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL),
(8, 'CMS', 'Chumsaeng', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL),
(9, 'PCT', 'Phichit', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL),
(10, 'PSN', 'Phitsanulok', '2025-10-22 13:15:44', '2025-10-22 13:15:44', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tickets`
--

CREATE TABLE `tickets` (
  `ticket_id` bigint(20) NOT NULL,
  `order_id` bigint(20) NOT NULL,
  `customer_id` bigint(20) NOT NULL,
  `service_id` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `status` enum('PAID','USED','CANCELLED','EXPIRED') NOT NULL DEFAULT 'PAID',
  `issued_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `used_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `cancel_reason` enum('USER_CANCELLED','STAFF_CANCELLED') DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Triggers `tickets`
--
DELIMITER $$
CREATE TRIGGER `tickets_before_insert` BEFORE INSERT ON `tickets` FOR EACH ROW BEGIN
    DECLARE chosen_service_id BIGINT;

    -- เลือก service_id ที่มี available > 0 โดยไม่เช็ค status
    SELECT service_id
    INTO chosen_service_id
    FROM services
    WHERE available > 0
    ORDER BY depart_at ASC
    LIMIT 1;

    -- กำหนด service_id ให้กับ ticket ใหม่
    SET NEW.service_id = chosen_service_id;

    -- ลดจำนวน available
    UPDATE services
    SET available = available - 1
    WHERE service_id = chosen_service_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `ticket_usage_log`
--

CREATE TABLE `ticket_usage_log` (
  `usage_id` bigint(20) NOT NULL,
  `ticket_id` bigint(20) NOT NULL,
  `staff_user_id` bigint(20) NOT NULL,
  `result` enum('ACCEPTED','REJECTED') NOT NULL,
  `note` varchar(100) DEFAULT NULL,
  `used_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`customer_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD KEY `idx_orders_customer_created` (`customer_id`,`created_at`);

--
-- Indexes for table `routes`
--
ALTER TABLE `routes`
  ADD PRIMARY KEY (`route_id`),
  ADD KEY `idx_routes_origin` (`origin_station_id`),
  ADD KEY `idx_routes_dest` (`dest_station_id`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`service_id`),
  ADD KEY `idx_services_route_depart` (`route_id`,`depart_at`),
  ADD KEY `idx_services_status` (`status`);

--
-- Indexes for table `staff_users`
--
ALTER TABLE `staff_users`
  ADD PRIMARY KEY (`staff_user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `stations`
--
ALTER TABLE `stations`
  ADD PRIMARY KEY (`station_id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Indexes for table `tickets`
--
ALTER TABLE `tickets`
  ADD PRIMARY KEY (`ticket_id`),
  ADD KEY `fk_tickets_order` (`order_id`),
  ADD KEY `idx_tickets_service_status` (`service_id`,`status`),
  ADD KEY `idx_tickets_customer_issued` (`customer_id`,`issued_at`);

--
-- Indexes for table `ticket_usage_log`
--
ALTER TABLE `ticket_usage_log`
  ADD PRIMARY KEY (`usage_id`),
  ADD KEY `fk_usage_staff` (`staff_user_id`),
  ADD KEY `idx_usage_ticket_used` (`ticket_id`,`used_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `routes`
--
ALTER TABLE `routes`
  MODIFY `route_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=91;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `service_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `staff_users`
--
ALTER TABLE `staff_users`
  MODIFY `staff_user_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `stations`
--
ALTER TABLE `stations`
  MODIFY `station_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tickets`
--
ALTER TABLE `tickets`
  MODIFY `ticket_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ticket_usage_log`
--
ALTER TABLE `ticket_usage_log`
  MODIFY `usage_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`);

--
-- Constraints for table `routes`
--
ALTER TABLE `routes`
  ADD CONSTRAINT `fk_routes_dest` FOREIGN KEY (`dest_station_id`) REFERENCES `stations` (`station_id`),
  ADD CONSTRAINT `fk_routes_origin` FOREIGN KEY (`origin_station_id`) REFERENCES `stations` (`station_id`);

--
-- Constraints for table `services`
--
ALTER TABLE `services`
  ADD CONSTRAINT `fk_services_route` FOREIGN KEY (`route_id`) REFERENCES `routes` (`route_id`);

--
-- Constraints for table `tickets`
--
ALTER TABLE `tickets`
  ADD CONSTRAINT `fk_tickets_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  ADD CONSTRAINT `fk_tickets_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`),
  ADD CONSTRAINT `fk_tickets_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`service_id`);

--
-- Constraints for table `ticket_usage_log`
--
ALTER TABLE `ticket_usage_log`
  ADD CONSTRAINT `fk_usage_staff` FOREIGN KEY (`staff_user_id`) REFERENCES `staff_users` (`staff_user_id`),
  ADD CONSTRAINT `fk_usage_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `tickets` (`ticket_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

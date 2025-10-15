-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Oct 15, 2025 at 09:19 AM
-- Server version: 5.7.44
-- PHP Version: 8.2.20

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
-- Table structure for table `cancel_ticket`
--

CREATE TABLE `cancel_ticket` (
  `cancel_id` int(11) NOT NULL,
  `ticket_id` int(11) NOT NULL,
  `reason` enum('USER_CANCELLED','LATE_REGISTRATION','ADMIN_CANCELLED','SYSTEM') NOT NULL,
  `note` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `paid_ticket`
--

CREATE TABLE `paid_ticket` (
  `ticket_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `service_id` int(11) NOT NULL,
  `quantity` tinyint(3) UNSIGNED NOT NULL DEFAULT '1',
  `status` enum('PAID','CANCELLED') NOT NULL DEFAULT 'PAID',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `route`
--

CREATE TABLE `route` (
  `route_id` int(11) NOT NULL,
  `origin` varchar(50) NOT NULL,
  `dest` varchar(50) NOT NULL,
  `origin_terminal` varchar(100) DEFAULT NULL,
  `price_thb` decimal(10,2) NOT NULL,
  `depart_time` time NOT NULL,
  `arrival_time` time NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `service`
--

CREATE TABLE `service` (
  `service_id` int(11) NOT NULL,
  `route_id` int(11) NOT NULL,
  `service_date` date NOT NULL,
  `available_ticket` int(10) UNSIGNED NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `used_ticket`
--

CREATE TABLE `used_ticket` (
  `ticket_id` int(11) NOT NULL,
  `use_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `pass` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cancel_ticket`
--
ALTER TABLE `cancel_ticket`
  ADD PRIMARY KEY (`cancel_id`),
  ADD KEY `idx_cancel_ticket` (`ticket_id`);

--
-- Indexes for table `paid_ticket`
--
ALTER TABLE `paid_ticket`
  ADD PRIMARY KEY (`ticket_id`),
  ADD KEY `fk_paid_service` (`service_id`),
  ADD KEY `idx_paid_user_service` (`user_id`,`service_id`);

--
-- Indexes for table `route`
--
ALTER TABLE `route`
  ADD PRIMARY KEY (`route_id`),
  ADD UNIQUE KEY `uniq_route_pattern` (`origin`,`dest`,`price_thb`,`depart_time`,`arrival_time`),
  ADD KEY `idx_route_city_time` (`origin`,`dest`,`depart_time`);

--
-- Indexes for table `service`
--
ALTER TABLE `service`
  ADD PRIMARY KEY (`service_id`),
  ADD UNIQUE KEY `uniq_route_date` (`route_id`,`service_date`),
  ADD KEY `idx_service_route_date` (`route_id`,`service_date`);

--
-- Indexes for table `used_ticket`
--
ALTER TABLE `used_ticket`
  ADD PRIMARY KEY (`ticket_id`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `cancel_ticket`
--
ALTER TABLE `cancel_ticket`
  MODIFY `cancel_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `paid_ticket`
--
ALTER TABLE `paid_ticket`
  MODIFY `ticket_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `route`
--
ALTER TABLE `route`
  MODIFY `route_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `service`
--
ALTER TABLE `service`
  MODIFY `service_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `cancel_ticket`
--
ALTER TABLE `cancel_ticket`
  ADD CONSTRAINT `fk_cancel_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `paid_ticket` (`ticket_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `paid_ticket`
--
ALTER TABLE `paid_ticket`
  ADD CONSTRAINT `fk_paid_service` FOREIGN KEY (`service_id`) REFERENCES `service` (`service_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_paid_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `service`
--
ALTER TABLE `service`
  ADD CONSTRAINT `fk_service_route` FOREIGN KEY (`route_id`) REFERENCES `route` (`route_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `used_ticket`
--
ALTER TABLE `used_ticket`
  ADD CONSTRAINT `fk_used_ticket` FOREIGN KEY (`ticket_id`) REFERENCES `paid_ticket` (`ticket_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

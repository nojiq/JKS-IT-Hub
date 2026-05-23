-- CreateTable
CREATE TABLE `ip_subnet_rules` (
    `id` CHAR(36) NOT NULL,
    `cidr` VARCHAR(50) NOT NULL,
    `network_address` VARCHAR(45) NOT NULL,
    `prefix_length` INTEGER NOT NULL,
    `range_start` BIGINT NOT NULL,
    `range_end` BIGINT NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ip_subnet_rules_cidr_key`(`cidr`),
    INDEX `idx_ip_subnet_rules_range`(`range_start`, `range_end`),
    INDEX `idx_ip_subnet_rules_purpose`(`purpose`),
    INDEX `idx_ip_subnet_rules_created_by`(`created_by_user_id`),
    INDEX `idx_ip_subnet_rules_updated_by`(`updated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manual_ip_records` (
    `id` CHAR(36) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `ip_address_int` BIGINT NOT NULL,
    `hostname` VARCHAR(255) NULL,
    `location` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `mac_address` VARCHAR(50) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` CHAR(36) NULL,
    `updated_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manual_ip_records_ip_address_key`(`ip_address`),
    INDEX `idx_manual_ip_records_ip_int`(`ip_address_int`),
    INDEX `idx_manual_ip_records_hostname`(`hostname`),
    INDEX `idx_manual_ip_records_location`(`location`),
    INDEX `idx_manual_ip_records_department`(`department`),
    INDEX `idx_manual_ip_records_created_by`(`created_by_user_id`),
    INDEX `idx_manual_ip_records_updated_by`(`updated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ip_subnet_rules` ADD CONSTRAINT `ip_subnet_rules_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ip_subnet_rules` ADD CONSTRAINT `ip_subnet_rules_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_ip_records` ADD CONSTRAINT `manual_ip_records_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_ip_records` ADD CONSTRAINT `manual_ip_records_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

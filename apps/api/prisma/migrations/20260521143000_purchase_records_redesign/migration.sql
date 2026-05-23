-- Drop old request foreign keys before renaming.
ALTER TABLE `item_requests` DROP FOREIGN KEY `item_requests_requester_id_fkey`;
ALTER TABLE `item_requests` DROP FOREIGN KEY `item_requests_it_reviewed_by_id_fkey`;
ALTER TABLE `item_requests` DROP FOREIGN KEY `item_requests_approved_by_id_fkey`;

-- Rename approval-first request table to purchase records.
RENAME TABLE `item_requests` TO `purchase_records`;

-- Add purchase-record fields while old fields still exist for data migration.
ALTER TABLE `purchase_records`
  ADD COLUMN `requested_for_user_id` CHAR(36) NULL,
  ADD COLUMN `reason` TEXT NULL,
  ADD COLUMN `recorded_by_id` CHAR(36) NULL,
  ADD COLUMN `purchased_by_id` CHAR(36) NULL,
  ADD COLUMN `purchase_date` DATETIME(3) NULL,
  ADD COLUMN `vendor_name` VARCHAR(191) NULL,
  ADD COLUMN `total_amount` DECIMAL(12, 2) NULL,
  ADD COLUMN `currency` CHAR(3) NOT NULL DEFAULT 'MYR',
  ADD COLUMN `notes` TEXT NULL,
  ADD COLUMN `record_status` ENUM('RECORDED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN `approval_status` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'SKIPPED', 'REJECTED') NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN `approval_note` TEXT NULL,
  ADD COLUMN `approval_skip_reason` TEXT NULL;

UPDATE `purchase_records`
SET
  `reason` = `justification`,
  `recorded_by_id` = `requester_id`,
  `record_status` = CASE
    WHEN `status` = 'REJECTED' THEN 'REJECTED'
    ELSE 'RECORDED'
  END,
  `approval_status` = CASE
    WHEN `status` = 'APPROVED' THEN 'APPROVED'
    WHEN `status` = 'REJECTED' THEN 'REJECTED'
    ELSE 'NOT_REQUIRED'
  END,
  `approval_note` = `it_review`,
  `approval_skip_reason` = CASE
    WHEN `status` = 'ALREADY_PURCHASED' THEN `it_review`
    ELSE NULL
  END;

ALTER TABLE `purchase_records`
  MODIFY `reason` TEXT NOT NULL,
  MODIFY `recorded_by_id` CHAR(36) NOT NULL;

-- Create item lines from old flat request fields.
CREATE TABLE `purchase_record_items` (
    `id` CHAR(36) NOT NULL,
    `purchase_record_id` CHAR(36) NOT NULL,
    `item_name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(100) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_cost` DECIMAL(12, 2) NULL,
    `line_total` DECIMAL(12, 2) NULL,
    `snipe_type` ENUM('HARDWARE', 'ACCESSORY', 'CONSUMABLE', 'LICENSE', 'COMPONENT') NULL,
    `snipe_id` INTEGER NULL,
    `snipe_display_name` VARCHAR(255) NULL,
    `snipe_verified_at` DATETIME(3) NULL,
    `snipe_snapshot` JSON NULL,
    `snipe_verification_status` ENUM('UNVERIFIED', 'VERIFIED', 'NOT_FOUND', 'ERROR') NOT NULL DEFAULT 'UNVERIFIED',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `purchase_record_items_purchase_record_id_idx`(`purchase_record_id`),
    INDEX `purchase_record_items_item_name_idx`(`item_name`),
    INDEX `purchase_record_items_category_idx`(`category`),
    INDEX `purchase_record_items_snipe_type_snipe_id_idx`(`snipe_type`, `snipe_id`),
    INDEX `purchase_record_items_snipe_verification_status_idx`(`snipe_verification_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `purchase_record_items` (
  `id`,
  `purchase_record_id`,
  `item_name`,
  `description`,
  `category`,
  `quantity`,
  `created_at`,
  `updated_at`
)
SELECT UUID(), `id`, `item_name`, `description`, `category`, 1, `created_at`, `updated_at`
FROM `purchase_records`;

-- Rebuild indexes under new names and remove obsolete indexes/columns.
ALTER TABLE `purchase_records`
  DROP INDEX `item_requests_requester_id_idx`,
  DROP INDEX `item_requests_status_idx`,
  DROP INDEX `item_requests_created_at_idx`,
  DROP INDEX `item_requests_priority_idx`,
  ADD INDEX `purchase_records_requester_id_idx`(`requester_id`),
  ADD INDEX `purchase_records_requested_for_user_id_idx`(`requested_for_user_id`),
  ADD INDEX `purchase_records_recorded_by_id_idx`(`recorded_by_id`),
  ADD INDEX `purchase_records_purchased_by_id_idx`(`purchased_by_id`),
  ADD INDEX `purchase_records_approved_by_id_idx`(`approved_by_id`),
  ADD INDEX `purchase_records_record_status_idx`(`record_status`),
  ADD INDEX `purchase_records_approval_status_idx`(`approval_status`),
  ADD INDEX `purchase_records_created_at_idx`(`created_at`),
  ADD INDEX `purchase_records_vendor_name_idx`(`vendor_name`);

ALTER TABLE `purchase_records`
  DROP COLUMN `item_name`,
  DROP COLUMN `description`,
  DROP COLUMN `justification`,
  DROP COLUMN `status`,
  DROP COLUMN `priority`,
  DROP COLUMN `category`,
  DROP COLUMN `it_review`,
  DROP COLUMN `it_reviewed_by_id`,
  DROP COLUMN `it_reviewed_at`,
  DROP COLUMN `rejection_reason`;

-- Add new foreign keys.
ALTER TABLE `purchase_records` ADD CONSTRAINT `purchase_records_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_records` ADD CONSTRAINT `purchase_records_requested_for_user_id_fkey` FOREIGN KEY (`requested_for_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `purchase_records` ADD CONSTRAINT `purchase_records_recorded_by_id_fkey` FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `purchase_records` ADD CONSTRAINT `purchase_records_purchased_by_id_fkey` FOREIGN KEY (`purchased_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `purchase_records` ADD CONSTRAINT `purchase_records_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `purchase_record_items` ADD CONSTRAINT `purchase_record_items_purchase_record_id_fkey` FOREIGN KEY (`purchase_record_id`) REFERENCES `purchase_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

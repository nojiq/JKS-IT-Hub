-- CreateTable
CREATE TABLE `item_requests` (
    `id` CHAR(36) NOT NULL,
    `requester_id` CHAR(36) NOT NULL,
    `item_name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `justification` TEXT NOT NULL,
    `status` ENUM('SUBMITTED', 'IT_REVIEWED', 'APPROVED', 'REJECTED', 'ALREADY_PURCHASED') NOT NULL DEFAULT 'SUBMITTED',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NULL DEFAULT 'MEDIUM',
    `category` VARCHAR(100) NULL,
    `invoice_file_url` VARCHAR(500) NULL,
    `it_review` TEXT NULL,
    `it_reviewed_by_id` CHAR(36) NULL,
    `it_reviewed_at` DATETIME(3) NULL,
    `approved_by_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `item_requests_requester_id_idx`(`requester_id`),
    INDEX `item_requests_status_idx`(`status`),
    INDEX `item_requests_created_at_idx`(`created_at`),
    INDEX `item_requests_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_notifications` (
    `id` CHAR(36) NOT NULL,
    `recipient_email` VARCHAR(255) NOT NULL,
    `recipient_user_id` CHAR(36) NULL,
    `subject` VARCHAR(500) NOT NULL,
    `template_type` VARCHAR(100) NOT NULL,
    `reference_type` VARCHAR(100) NULL,
    `reference_id` CHAR(36) NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_notifications_recipient_email_idx`(`recipient_email`),
    INDEX `email_notifications_status_idx`(`status`),
    INDEX `email_notifications_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_requests` ADD CONSTRAINT `item_requests_requester_id_fkey` FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_requests` ADD CONSTRAINT `item_requests_it_reviewed_by_id_fkey` FOREIGN KEY (`it_reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_requests` ADD CONSTRAINT `item_requests_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_notifications` ADD CONSTRAINT `email_notifications_recipient_user_id_fkey` FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

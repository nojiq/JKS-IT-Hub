-- AlterTable
ALTER TABLE `maintenance_windows` ADD COLUMN `overdue_notification_sent_at` DATETIME(3) NULL,
    ADD COLUMN `upcoming_notification_sent_at` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `in_app_notifications` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `reference_type` VARCHAR(100) NULL,
    `reference_id` CHAR(36) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `in_app_notifications_user_id_is_read_idx`(`user_id`, `is_read`),
    INDEX `in_app_notifications_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `in_app_notifications_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `in_app_notifications` ADD CONSTRAINT `in_app_notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `maintenance_completions` ADD COLUMN `device_types` JSON NULL;

-- CreateTable
CREATE TABLE `maintenance_window_device_types` (
    `id` VARCHAR(191) NOT NULL,
    `window_id` VARCHAR(191) NOT NULL,
    `device_type` ENUM('LAPTOP', 'DESKTOP_PC', 'SERVER') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `maintenance_window_device_types_device_type_idx`(`device_type`),
    UNIQUE INDEX `maintenance_window_device_types_window_id_device_type_key`(`window_id`, `device_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_window_device_types` ADD CONSTRAINT `maintenance_window_device_types_window_id_fkey` FOREIGN KEY (`window_id`) REFERENCES `maintenance_windows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

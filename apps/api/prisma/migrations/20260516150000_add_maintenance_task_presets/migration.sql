-- CreateTable
CREATE TABLE `maintenance_task_presets` (
    `id` CHAR(36) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_task_presets_title_key`(`title`),
    INDEX `maintenance_task_presets_is_active_category_idx`(`is_active`, `category`),
    INDEX `maintenance_task_presets_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `checklist_items` ADD COLUMN `task_preset_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `maintenance_run_items` ADD COLUMN `task_preset_id` CHAR(36) NULL;

-- AlterEnum
ALTER TABLE `maintenance_run_items`
    MODIFY `status` ENUM('pending', 'pass', 'fail', 'repair', 'na') NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX `checklist_items_task_preset_id_idx` ON `checklist_items`(`task_preset_id`);

-- CreateIndex
CREATE INDEX `maintenance_run_items_task_preset_id_idx` ON `maintenance_run_items`(`task_preset_id`);

-- AddForeignKey
ALTER TABLE `maintenance_task_presets` ADD CONSTRAINT `maintenance_task_presets_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_items` ADD CONSTRAINT `checklist_items_task_preset_id_fkey` FOREIGN KEY (`task_preset_id`) REFERENCES `maintenance_task_presets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_run_items` ADD CONSTRAINT `maintenance_run_items_task_preset_id_fkey` FOREIGN KEY (`task_preset_id`) REFERENCES `maintenance_task_presets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed standard maintenance tasks from the existing IT checklist.
INSERT INTO `maintenance_task_presets` (`id`, `title`, `description`, `category`, `is_active`, `created_at`, `updated_at`) VALUES
(UUID(), 'Monitor', 'Test and clean the monitor.', 'Hardware', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Keyboard', 'Test and clean the keyboard.', 'Hardware', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Mouse', 'Test and clean the mouse.', 'Hardware', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Reboot device', 'Restart the device to clear pending updates and temporary system cache.', 'System', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Clean hardware system', 'Clean internal and external hardware where appropriate.', 'Hardware', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Hard drive', 'Check drive health. Defragment only when the drive is an HDD.', 'Storage', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Battery', 'Check battery health and cycle count.', 'Hardware', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Windows Update', 'Install the latest Windows updates.', 'Software', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Antivirus software', 'Update antivirus software and confirm protection status.', 'Software', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Nextcloud', 'Install the latest Nextcloud update.', 'Software', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Disk cleanup', 'Remove old system files.', 'System', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Temporary internet files', 'Remove temporary internet files.', 'System', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Thermal paste check', 'Check CPU temperature and replace thermal paste only when needed.', 'Hardware', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'Belarc Advisor', 'Record and save device specifications.', 'Audit', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
(UUID(), 'MAC address record', 'Record LAN and Wi-Fi MAC addresses.', 'Network', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- AlterTable
ALTER TABLE `maintenance_cycle_configs` ADD COLUMN `default_checklist_template_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `maintenance_windows` ADD COLUMN `checklist_template_id` VARCHAR(191) NULL,
    ADD COLUMN `checklist_version` INTEGER NULL;

-- CreateTable
CREATE TABLE `maintenance_checklist_templates` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_checklist_templates_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `maintenance_checklist_items_template_id_order_index_idx`(`template_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_cycle_configs` ADD CONSTRAINT `maintenance_cycle_configs_default_checklist_template_id_fkey` FOREIGN KEY (`default_checklist_template_id`) REFERENCES `maintenance_checklist_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_windows` ADD CONSTRAINT `maintenance_windows_checklist_template_id_fkey` FOREIGN KEY (`checklist_template_id`) REFERENCES `maintenance_checklist_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_checklist_items` ADD CONSTRAINT `maintenance_checklist_items_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `maintenance_checklist_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

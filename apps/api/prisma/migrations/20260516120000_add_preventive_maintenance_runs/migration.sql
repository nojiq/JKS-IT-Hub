-- CreateTable
CREATE TABLE `maintenance_profiles` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `interval_months` INTEGER NOT NULL,
    `grace_period_days` INTEGER NOT NULL DEFAULT 0,
    `active_template_id` CHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_profiles_name_key`(`name`),
    INDEX `maintenance_profiles_isActive_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_templates` (
    `id` CHAR(36) NOT NULL,
    `profile_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `checklist_templates_profile_id_version_key`(`profile_id`, `version`),
    INDEX `checklist_templates_profile_id_is_active_idx`(`profile_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_items` (
    `id` CHAR(36) NOT NULL,
    `template_id` CHAR(36) NOT NULL,
    `sort_order` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `evidence_required` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `checklist_items_template_id_sort_order_key`(`template_id`, `sort_order`),
    INDEX `checklist_items_template_id_idx`(`template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_assignments` (
    `id` CHAR(36) NOT NULL,
    `profile_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `asset_id` CHAR(36) NOT NULL,
    `status` ENUM('active', 'paused', 'archived') NOT NULL DEFAULT 'active',
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NULL,
    `archived_at` DATETIME(3) NULL,
    `archive_reason` TEXT NULL,
    `active_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uniq_active_pm_assignment`(`active_key`),
    INDEX `maintenance_assignments_profileId_idx`(`profile_id`),
    INDEX `maintenance_assignments_assetId_idx`(`asset_id`),
    INDEX `maintenance_assignments_userId_idx`(`user_id`),
    INDEX `maintenance_assignments_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_runs` (
    `id` CHAR(36) NOT NULL,
    `assignment_id` CHAR(36) NOT NULL,
    `profile_id` CHAR(36) NOT NULL,
    `asset_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `checklist_template_id` CHAR(36) NULL,
    `checklist_version` INTEGER NULL,
    `checklist_snapshot` JSON NULL,
    `due_date` DATETIME(3) NOT NULL,
    `status` ENUM('scheduled', 'due', 'in_progress', 'completed', 'overdue', 'skipped', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `completed_by_id` CHAR(36) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` TEXT NULL,
    `skipped_at` DATETIME(3) NULL,
    `skip_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uniq_assignment_due_date`(`assignment_id`, `due_date`),
    INDEX `maintenance_runs_status_dueDate_idx`(`status`, `due_date`),
    INDEX `maintenance_runs_assetId_idx`(`asset_id`),
    INDEX `maintenance_runs_userId_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_run_items` (
    `id` CHAR(36) NOT NULL,
    `run_id` CHAR(36) NOT NULL,
    `checklist_item_id` CHAR(36) NULL,
    `sort_order` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL,
    `evidence_required` BOOLEAN NOT NULL,
    `status` ENUM('pending', 'pass', 'fail', 'na') NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `evidence_url` TEXT NULL,
    `completed_by_id` CHAR(36) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_run_items_run_id_sort_order_key`(`run_id`, `sort_order`),
    INDEX `maintenance_run_items_run_id_idx`(`run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_profiles` ADD CONSTRAINT `maintenance_profiles_active_template_id_fkey` FOREIGN KEY (`active_template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_templates` ADD CONSTRAINT `checklist_templates_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `maintenance_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_items` ADD CONSTRAINT `checklist_items_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_assignments` ADD CONSTRAINT `maintenance_assignments_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `maintenance_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_assignments` ADD CONSTRAINT `maintenance_assignments_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_assignments` ADD CONSTRAINT `maintenance_assignments_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_runs` ADD CONSTRAINT `maintenance_runs_assignment_id_fkey` FOREIGN KEY (`assignment_id`) REFERENCES `maintenance_assignments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_runs` ADD CONSTRAINT `maintenance_runs_profile_id_fkey` FOREIGN KEY (`profile_id`) REFERENCES `maintenance_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_runs` ADD CONSTRAINT `maintenance_runs_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_runs` ADD CONSTRAINT `maintenance_runs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_runs` ADD CONSTRAINT `maintenance_runs_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_runs` ADD CONSTRAINT `maintenance_runs_checklist_template_id_fkey` FOREIGN KEY (`checklist_template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_run_items` ADD CONSTRAINT `maintenance_run_items_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `maintenance_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_run_items` ADD CONSTRAINT `maintenance_run_items_checklist_item_id_fkey` FOREIGN KEY (`checklist_item_id`) REFERENCES `checklist_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_run_items` ADD CONSTRAINT `maintenance_run_items_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

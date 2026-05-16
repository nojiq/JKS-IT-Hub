-- CreateTable
CREATE TABLE `assets` (
    `id` CHAR(36) NOT NULL,
    `snipe_asset_id` INTEGER NOT NULL,
    `asset_tag` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NULL,
    `serial` VARCHAR(255) NULL,
    `model_name` VARCHAR(255) NULL,
    `category_name` VARCHAR(191) NULL,
    `status_label` VARCHAR(191) NULL,
    `snipe_assigned_id` INTEGER NULL,
    `snipe_assigned_type` VARCHAR(50) NULL,
    `snipe_assigned_name` VARCHAR(255) NULL,
    `snipe_assigned_username` VARCHAR(191) NULL,
    `snipe_assigned_email` VARCHAR(255) NULL,
    `assigned_to_user_id` CHAR(36) NULL,
    `assignment_source` VARCHAR(50) NOT NULL DEFAULT 'unassigned',
    `assignment_fingerprint` VARCHAR(500) NULL,
    `last_synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `assets_snipe_asset_id_key`(`snipe_asset_id`),
    UNIQUE INDEX `assets_asset_tag_key`(`asset_tag`),
    INDEX `idx_assets_assigned_to_user_id`(`assigned_to_user_id`),
    INDEX `idx_assets_assignment_source`(`assignment_source`),
    INDEX `idx_assets_status_label`(`status_label`),
    INDEX `idx_assets_category_name`(`category_name`),
    INDEX `idx_assets_last_synced_at`(`last_synced_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_sync_runs` (
    `id` CHAR(36) NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'started',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finished_at` DATETIME(3) NULL,
    `fetched_count` INTEGER NOT NULL DEFAULT 0,
    `upserted_count` INTEGER NOT NULL DEFAULT 0,
    `matched_count` INTEGER NOT NULL DEFAULT 0,
    `unmatched_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,

    INDEX `idx_asset_sync_runs_status`(`status`),
    INDEX `idx_asset_sync_runs_started_at`(`started_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_assigned_to_user_id_fkey` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `status` ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
    `role` ENUM('it', 'admin', 'head_it', 'requester') NOT NULL DEFAULT 'requester',
    `ldap_dn` TEXT NULL,
    `ldap_attributes` JSON NULL,
    `ldap_synced_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ldap_sync_runs` (
    `id` CHAR(36) NOT NULL,
    `status` ENUM('started', 'completed', 'failed') NOT NULL DEFAULT 'started',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `processed_count` INTEGER NOT NULL DEFAULT 0,
    `created_count` INTEGER NOT NULL DEFAULT 0,
    `updated_count` INTEGER NOT NULL DEFAULT 0,
    `skipped_count` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `triggered_by_user_id` CHAR(36) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actor_user_id` CHAR(36) NOT NULL,
    `entity_type` VARCHAR(191) NULL,
    `entity_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ldap_sync_runs` ADD CONSTRAINT `ldap_sync_runs_triggered_by_user_id_fkey` FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

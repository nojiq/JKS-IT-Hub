/*
  Warnings:

  - You are about to drop the column `is_active` on the `credential_versions` table. All the data in the column will be lost.
  - You are about to drop the column `ldap_sources` on the `credential_versions` table. All the data in the column will be lost.
  - You are about to drop the column `system` on the `credential_versions` table. All the data in the column will be lost.
  - You are about to drop the column `template_version` on the `credential_versions` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `credential_versions` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `credential_versions` DROP FOREIGN KEY `credential_versions_user_id_fkey`;

-- DropIndex
DROP INDEX `idx_credential_versions_system` ON `credential_versions`;

-- DropIndex
DROP INDEX `idx_credential_versions_user_id_created_at` ON `credential_versions`;

-- AlterTable
ALTER TABLE `credential_versions` DROP COLUMN `is_active`,
    DROP COLUMN `ldap_sources`,
    DROP COLUMN `system`,
    DROP COLUMN `template_version`,
    DROP COLUMN `user_id`;

-- CreateTable
CREATE TABLE `normalization_rules` (
    `id` CHAR(36) NOT NULL,
    `system_id` VARCHAR(191) NULL,
    `rule_type` VARCHAR(191) NOT NULL,
    `rule_config` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_normalization_rules_system_id`(`system_id`),
    INDEX `idx_normalization_rules_is_active`(`is_active`),
    INDEX `idx_normalization_rules_priority`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locked_credentials` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `system_id` VARCHAR(191) NOT NULL,
    `is_locked` BOOLEAN NOT NULL DEFAULT true,
    `locked_by` CHAR(36) NOT NULL,
    `locked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lock_reason` VARCHAR(255) NULL,
    `unlocked_by` CHAR(36) NULL,
    `unlocked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `locked_credentials_user_id_system_id_key`(`user_id`, `system_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `normalization_rules` ADD CONSTRAINT `normalization_rules_system_id_fkey` FOREIGN KEY (`system_id`) REFERENCES `system_configs`(`system_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locked_credentials` ADD CONSTRAINT `locked_credentials_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locked_credentials` ADD CONSTRAINT `locked_credentials_system_id_fkey` FOREIGN KEY (`system_id`) REFERENCES `system_configs`(`system_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

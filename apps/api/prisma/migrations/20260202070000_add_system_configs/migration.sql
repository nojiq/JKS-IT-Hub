-- AddSystemConfigs
-- Create system_configs table and update user_credentials to reference it

-- Create system_configs table
CREATE TABLE `system_configs` (
    `id` CHAR(36) NOT NULL,
    `system_id` VARCHAR(191) NOT NULL,
    `username_ldap_field` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_configs_system_id_key`(`system_id`),
    INDEX `idx_system_configs_system_id`(`system_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add system_id column to user_credentials table
ALTER TABLE `user_credentials` ADD COLUMN `system_id` VARCHAR(191) NULL;

-- Create index on system_id for user_credentials
CREATE INDEX `idx_user_credentials_system_id` ON `user_credentials`(`system_id`);

-- Add foreign key constraint
ALTER TABLE `user_credentials` ADD CONSTRAINT `user_credentials_system_id_fkey` 
    FOREIGN KEY (`system_id`) REFERENCES `system_configs`(`system_id`) 
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Update the unique constraint to use system_id instead of system
ALTER TABLE `user_credentials` DROP INDEX `idx_user_credentials_unique_active`;
ALTER TABLE `user_credentials` ADD UNIQUE INDEX `idx_user_credentials_unique_active`(`user_id`, `system_id`, `is_active`);

-- Drop the old system index
DROP INDEX `idx_user_credentials_system` ON `user_credentials`;

-- Drop the old system column
ALTER TABLE `user_credentials` DROP COLUMN `system`;
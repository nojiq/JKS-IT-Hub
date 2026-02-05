-- Migration: Add history support fields to credential_versions
-- Created for Story 2.5: Credential History

-- Add user_id column for direct history queries
ALTER TABLE `credential_versions` ADD COLUMN `user_id` CHAR(36) NULL AFTER `credential_id`;

-- Add system column to track which system the credential belongs to
ALTER TABLE `credential_versions` ADD COLUMN `system` VARCHAR(191) NULL AFTER `user_id`;

-- Add template_version column to track which template was used
ALTER TABLE `credential_versions` ADD COLUMN `template_version` INT NULL AFTER `system`;

-- Add ldap_sources JSON column to snapshot LDAP field mappings
ALTER TABLE `credential_versions` ADD COLUMN `ldap_sources` JSON NULL AFTER `template_version`;

-- Add is_active boolean to distinguish current vs historical
ALTER TABLE `credential_versions` ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT false AFTER `ldap_sources`;

-- Create composite index for efficient history queries by user + date
CREATE INDEX `idx_credential_versions_user_id_created_at` ON `credential_versions`(`user_id`, `created_at` DESC);

-- Create index for system filtering
CREATE INDEX `idx_credential_versions_system` ON `credential_versions`(`system`);

-- Add foreign key constraint for user_id
ALTER TABLE `credential_versions` 
  ADD CONSTRAINT `credential_versions_user_id_fkey` 
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) 
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill existing records with data from user_credentials
-- This populates the new columns based on the linked credential
UPDATE `credential_versions` cv
INNER JOIN `user_credentials` uc ON cv.credential_id = uc.id
SET 
  cv.user_id = uc.user_id,
  cv.system = uc.system,
  cv.template_version = uc.template_version,
  cv.is_active = uc.is_active;

-- Make user_id NOT NULL after backfill
ALTER TABLE `credential_versions` MODIFY COLUMN `user_id` CHAR(36) NOT NULL;

-- Make system NOT NULL after backfill  
ALTER TABLE `credential_versions` MODIFY COLUMN `system` VARCHAR(191) NOT NULL;

-- Make template_version NOT NULL after backfill
ALTER TABLE `credential_versions` MODIFY COLUMN `template_version` INT NOT NULL;

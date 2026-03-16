-- CreateTable
CREATE TABLE `onboarding_catalog_items` (
  `id` CHAR(36) NOT NULL,
  `item_key` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `login_url` TEXT NOT NULL,
  `notes` TEXT NULL,
  `is_it_only` BOOLEAN NOT NULL DEFAULT false,
  `created_by_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `onboarding_catalog_items_item_key_key`(`item_key`),
  INDEX `idx_onboarding_catalog_items_item_key`(`item_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_department_bundles` (
  `id` CHAR(36) NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `onboarding_department_bundles_department_key`(`department`),
  INDEX `idx_onboarding_department_bundles_department`(`department`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_department_bundle_items` (
  `id` CHAR(36) NOT NULL,
  `bundle_id` CHAR(36) NOT NULL,
  `catalog_item_id` CHAR(36) NOT NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uniq_onboarding_bundle_catalog_item`(`bundle_id`, `catalog_item_id`),
  INDEX `idx_onboarding_bundle_items_bundle_id`(`bundle_id`),
  INDEX `idx_onboarding_bundle_items_catalog_item_id`(`catalog_item_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_drafts` (
  `id` CHAR(36) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `department` VARCHAR(191) NOT NULL,
  `linked_user_id` CHAR(36) NULL,
  `created_by_id` CHAR(36) NULL,
  `linked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `idx_onboarding_drafts_department`(`department`),
  INDEX `idx_onboarding_drafts_linked_user_id`(`linked_user_id`),
  INDEX `idx_onboarding_drafts_email`(`email`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_draft_credentials` (
  `id` CHAR(36) NOT NULL,
  `draft_id` CHAR(36) NOT NULL,
  `catalog_item_id` CHAR(36) NOT NULL,
  `username` VARCHAR(191) NOT NULL,
  `password` TEXT NOT NULL,
  `template_version` INTEGER NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `idx_onboarding_draft_credentials_draft_id`(`draft_id`),
  INDEX `idx_onboarding_draft_credentials_catalog_item_id`(`catalog_item_id`),
  INDEX `idx_onboarding_draft_credentials_is_active`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `onboarding_department_bundle_items`
  ADD CONSTRAINT `onboarding_department_bundle_items_bundle_id_fkey`
  FOREIGN KEY (`bundle_id`) REFERENCES `onboarding_department_bundles`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_department_bundle_items`
  ADD CONSTRAINT `onboarding_department_bundle_items_catalog_item_id_fkey`
  FOREIGN KEY (`catalog_item_id`) REFERENCES `onboarding_catalog_items`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_draft_credentials`
  ADD CONSTRAINT `onboarding_draft_credentials_draft_id_fkey`
  FOREIGN KEY (`draft_id`) REFERENCES `onboarding_drafts`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `onboarding_draft_credentials`
  ADD CONSTRAINT `onboarding_draft_credentials_catalog_item_id_fkey`
  FOREIGN KEY (`catalog_item_id`) REFERENCES `onboarding_catalog_items`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

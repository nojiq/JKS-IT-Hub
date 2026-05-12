CREATE TABLE `user_field_definitions` (
    `id` CHAR(36) NOT NULL,
    `field_key` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `field_type` VARCHAR(50) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `sensitive` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_field_definitions_field_key_key`(`field_key`),
    INDEX `idx_user_field_definitions_active_order`(`is_active`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `user_field_values` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `field_definition_id` CHAR(36) NOT NULL,
    `value` TEXT NULL,
    `updated_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uniq_user_field_values_user_definition`(`user_id`, `field_definition_id`),
    INDEX `idx_user_field_values_definition_id`(`field_definition_id`),
    INDEX `idx_user_field_values_user_id`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_field_values`
    ADD CONSTRAINT `user_field_values_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_field_values`
    ADD CONSTRAINT `user_field_values_field_definition_id_fkey`
    FOREIGN KEY (`field_definition_id`) REFERENCES `user_field_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `user_field_definitions`
    (`id`, `field_key`, `label`, `field_type`, `required`, `sensitive`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
    (UUID(), 'name', 'Name', 'text', true, false, true, 10, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'email', 'Email', 'email', true, false, true, 20, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'date', 'Date', 'date', false, false, true, 30, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'temporary-password', 'Temporary Password', 'password', false, true, true, 40, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'actual-password', 'Actual Password', 'password', false, true, true, 50, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'android-password', 'Android Password', 'password', false, true, true, 60, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'iphone-mail', 'iPhone Mail', 'text', false, false, true, 70, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'ipad-mail', 'iPad Mail', 'text', false, false, true, 80, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'mac-mail', 'Mac Mail', 'text', false, false, true, 90, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'outlook-ios', 'Outlook iOS', 'text', false, false, true, 100, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'outlook-android', 'Outlook Android', 'text', false, false, true, 110, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'outlook-desktop', 'Outlook Desktop', 'text', false, false, true, 120, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'active-directory', 'Active Directory', 'text', false, false, true, 130, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'remarks', 'Remarks', 'textarea', false, false, true, 140, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `user_field_definitions`
    (`id`, `field_key`, `label`, `field_type`, `required`, `sensitive`, `is_active`, `sort_order`, `created_at`, `updated_at`)
VALUES
    (UUID(), 'status', 'Status', 'text', false, false, true, 140, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
    (UUID(), 'category', 'Category', 'text', false, false, true, 150, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
    `label` = VALUES(`label`),
    `field_type` = VALUES(`field_type`),
    `required` = VALUES(`required`),
    `sensitive` = VALUES(`sensitive`),
    `is_active` = VALUES(`is_active`),
    `sort_order` = VALUES(`sort_order`),
    `updated_at` = CURRENT_TIMESTAMP(3);

UPDATE `user_field_definitions`
SET `sort_order` = 160,
    `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `field_key` = 'remarks';

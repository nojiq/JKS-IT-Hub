-- AlterTable MaintenanceWindow - Add assignment fields
ALTER TABLE `maintenance_windows` 
ADD COLUMN `assigned_to_id` CHAR(36) NULL,
ADD COLUMN `assignment_timestamp` DATETIME(3) NULL,
ADD COLUMN `assignment_reason` VARCHAR(191) NULL,
ADD COLUMN `department_id` VARCHAR(191) NULL,
ADD INDEX `maintenance_windows_assigned_to_id_idx`(`assigned_to_id`),
ADD INDEX `maintenance_windows_department_id_idx`(`department_id`);

-- CreateTable DepartmentAssignmentRule
CREATE TABLE `department_assignment_rules` (
    `id` CHAR(36) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `assignment_strategy` ENUM('FIXED', 'ROTATION') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `department_assignment_rules_department_key`(`department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable DepartmentAssignmentTechnician
CREATE TABLE `department_assignment_technicians` (
    `id` CHAR(36) NOT NULL,
    `rule_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `order_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `department_assignment_technicians_rule_id_order_index_idx`(`rule_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable DepartmentRotationState
CREATE TABLE `department_rotation_states` (
    `id` CHAR(36) NOT NULL,
    `rule_id` CHAR(36) NOT NULL,
    `current_technician_index` INTEGER NOT NULL DEFAULT 0,
    `last_assigned_at` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `department_rotation_states_rule_id_key`(`rule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_windows` ADD CONSTRAINT `maintenance_windows_assigned_to_id_fkey` FOREIGN KEY (`assigned_to_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_assignment_technicians` ADD CONSTRAINT `department_assignment_technicians_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `department_assignment_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_assignment_technicians` ADD CONSTRAINT `department_assignment_technicians_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_rotation_states` ADD CONSTRAINT `department_rotation_states_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `department_assignment_rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

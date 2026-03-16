/*
  Warnings:

  - The primary key for the `department_assignment_rules` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `assignment_strategy` on the `department_assignment_rules` table. All the data in the column will be lost.
  - The primary key for the `department_assignment_technicians` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `department_rotation_states` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Added the required column `assignmentStrategy` to the `department_assignment_rules` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `department_assignment_technicians` DROP FOREIGN KEY `department_assignment_technicians_rule_id_fkey`;

-- DropForeignKey
ALTER TABLE `department_assignment_technicians` DROP FOREIGN KEY `department_assignment_technicians_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `department_rotation_states` DROP FOREIGN KEY `department_rotation_states_rule_id_fkey`;

-- DropForeignKey
ALTER TABLE `maintenance_windows` DROP FOREIGN KEY `maintenance_windows_assigned_to_id_fkey`;

-- DropIndex
DROP INDEX `department_assignment_technicians_user_id_fkey` ON `department_assignment_technicians`;

-- AlterTable
ALTER TABLE `department_assignment_rules` DROP PRIMARY KEY,
    DROP COLUMN `assignment_strategy`,
    ADD COLUMN `assignmentStrategy` ENUM('FIXED', 'ROTATION') NOT NULL,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `department_assignment_technicians` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `rule_id` VARCHAR(191) NOT NULL,
    MODIFY `user_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `department_rotation_states` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `rule_id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `maintenance_windows` MODIFY `assigned_to_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `maintenance_completions` (
    `id` VARCHAR(191) NOT NULL,
    `window_id` VARCHAR(191) NOT NULL,
    `completed_by_id` VARCHAR(191) NOT NULL,
    `completed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_completions_window_id_key`(`window_id`),
    INDEX `maintenance_completions_completed_by_id_idx`(`completed_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_item_completions` (
    `id` VARCHAR(191) NOT NULL,
    `completion_id` VARCHAR(191) NOT NULL,
    `checklist_item_id` VARCHAR(191) NOT NULL,
    `item_title` VARCHAR(191) NOT NULL,
    `item_description` TEXT NULL,
    `is_required` BOOLEAN NOT NULL,
    `is_completed` BOOLEAN NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `checklist_item_completions_completion_id_idx`(`completion_id`),
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

-- AddForeignKey
ALTER TABLE `maintenance_completions` ADD CONSTRAINT `maintenance_completions_window_id_fkey` FOREIGN KEY (`window_id`) REFERENCES `maintenance_windows`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_completions` ADD CONSTRAINT `maintenance_completions_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_item_completions` ADD CONSTRAINT `checklist_item_completions_completion_id_fkey` FOREIGN KEY (`completion_id`) REFERENCES `maintenance_completions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

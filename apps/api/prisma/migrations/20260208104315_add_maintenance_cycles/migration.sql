-- CreateTable
CREATE TABLE `maintenance_cycle_configs` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `intervalMonths` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_windows` (
    `id` VARCHAR(191) NOT NULL,
    `cycleConfigId` VARCHAR(191) NOT NULL,
    `scheduledStartDate` DATETIME(3) NOT NULL,
    `scheduledEndDate` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'UPCOMING', 'OVERDUE', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `maintenance_windows_cycleConfigId_idx`(`cycleConfigId`),
    INDEX `maintenance_windows_status_idx`(`status`),
    INDEX `maintenance_windows_scheduledStartDate_idx`(`scheduledStartDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_windows` ADD CONSTRAINT `maintenance_windows_cycleConfigId_fkey` FOREIGN KEY (`cycleConfigId`) REFERENCES `maintenance_cycle_configs`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_windows` ADD CONSTRAINT `maintenance_windows_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

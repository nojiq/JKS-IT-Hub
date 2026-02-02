-- DropForeignKey
ALTER TABLE `audit_logs` DROP FOREIGN KEY `audit_logs_actor_user_id_fkey`;

-- DropForeignKey
ALTER TABLE `ldap_sync_runs` DROP FOREIGN KEY `ldap_sync_runs_triggered_by_user_id_fkey`;

-- DropIndex
DROP INDEX `audit_logs_actor_user_id_fkey` ON `audit_logs`;

-- DropIndex
DROP INDEX `ldap_sync_runs_triggered_by_user_id_fkey` ON `ldap_sync_runs`;

-- AlterTable
ALTER TABLE `audit_logs` MODIFY `actor_user_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `ldap_sync_runs` MODIFY `triggered_by_user_id` CHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `ldap_sync_runs` ADD CONSTRAINT `ldap_sync_runs_triggered_by_user_id_fkey` FOREIGN KEY (`triggered_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

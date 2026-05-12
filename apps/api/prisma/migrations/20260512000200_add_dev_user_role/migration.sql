-- AlterTable: add developer role (highest privilege tier for restricted modules)
ALTER TABLE `users` MODIFY `role` ENUM('it', 'admin', 'head_it', 'requester', 'dev') NOT NULL DEFAULT 'requester';

UPDATE `users` SET `role` = 'dev' WHERE `username` = 'haziq.afendi';

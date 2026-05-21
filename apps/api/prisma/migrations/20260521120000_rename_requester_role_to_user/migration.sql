ALTER TABLE `users` MODIFY `role` ENUM('it', 'admin', 'head_it', 'requester', 'dev', 'user') NOT NULL DEFAULT 'user';
UPDATE `users` SET `role` = 'user' WHERE `role` = 'requester';
ALTER TABLE `users` MODIFY `role` ENUM('it', 'admin', 'head_it', 'user', 'dev') NOT NULL DEFAULT 'user';

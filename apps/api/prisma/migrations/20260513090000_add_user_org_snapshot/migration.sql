ALTER TABLE `users`
  ADD COLUMN `org_snapshot` JSON NULL,
  ADD COLUMN `org_synced_at` DATETIME(3) NULL;

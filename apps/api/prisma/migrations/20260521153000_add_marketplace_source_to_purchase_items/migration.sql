ALTER TABLE `purchase_record_items`
  ADD COLUMN `image_file_url` VARCHAR(500) NULL,
  ADD COLUMN `source_url` VARCHAR(1000) NULL,
  ADD COLUMN `source_marketplace` VARCHAR(30) NULL,
  ADD COLUMN `source_image_url` VARCHAR(1000) NULL,
  ADD COLUMN `source_snapshot` JSON NULL;

CREATE INDEX `purchase_record_items_source_marketplace_idx` ON `purchase_record_items`(`source_marketplace`);

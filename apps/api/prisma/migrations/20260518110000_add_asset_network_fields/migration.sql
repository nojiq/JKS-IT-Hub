-- AlterTable
ALTER TABLE `assets`
  ADD COLUMN `ip_address` VARCHAR(45) NULL,
  ADD COLUMN `mac_address_lan` VARCHAR(50) NULL,
  ADD COLUMN `mac_address_wifi_5ghz` VARCHAR(50) NULL,
  ADD COLUMN `mac_address_wifi_24ghz` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `idx_assets_ip_address` ON `assets`(`ip_address`);

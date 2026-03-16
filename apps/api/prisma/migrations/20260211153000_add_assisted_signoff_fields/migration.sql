-- AlterTable
ALTER TABLE `maintenance_completions`
  ADD COLUMN `signer_name` VARCHAR(200) NULL,
  ADD COLUMN `signer_signature_url` VARCHAR(191) NULL,
  ADD COLUMN `signer_confirmed_at` DATETIME(3) NULL,
  ADD COLUMN `signoff_mode` ENUM('STANDARD', 'ASSISTED') NOT NULL DEFAULT 'STANDARD';

-- CreateIndex
CREATE INDEX `maintenance_completions_signer_signature_url_idx`
  ON `maintenance_completions`(`signer_signature_url`);

-- Add metadata snapshots for deterministic credential flows.
ALTER TABLE `user_credentials`
  ADD COLUMN `metadata` JSON NULL AFTER `password`;

ALTER TABLE `credential_versions`
  ADD COLUMN `metadata` JSON NULL AFTER `password`;

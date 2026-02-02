-- CreateIndex
CREATE INDEX `idx_audit_logs_action` ON `audit_logs`(`action`);

-- CreateIndex
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs`(`created_at`);

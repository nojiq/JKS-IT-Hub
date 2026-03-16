-- Story 2.4 review fix: speed up active credential lookups by user
CREATE INDEX `idx_user_credentials_user_id_is_active`
ON `user_credentials`(`user_id`, `is_active`);

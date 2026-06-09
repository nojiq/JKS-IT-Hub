-- Add structured measurement support for preventive maintenance checklist tasks.
ALTER TABLE `maintenance_task_presets`
    ADD COLUMN `measurement_type` VARCHAR(50) NOT NULL DEFAULT 'none';

ALTER TABLE `checklist_items`
    ADD COLUMN `measurement_type` VARCHAR(50) NOT NULL DEFAULT 'none';

ALTER TABLE `maintenance_run_items`
    ADD COLUMN `measurement_type` VARCHAR(50) NOT NULL DEFAULT 'none',
    ADD COLUMN `measurements` JSON NULL;

-- Backfill known task types from existing saved task titles and checklist titles.
UPDATE `maintenance_task_presets`
SET `measurement_type` = CASE
    WHEN LOWER(`title`) = 'battery' THEN 'battery'
    WHEN LOWER(`title`) IN ('hard drive', 'hdd', 'ssd') THEN 'hard_drive'
    ELSE `measurement_type`
END;

UPDATE `checklist_items`
SET `measurement_type` = CASE
    WHEN LOWER(`title`) = 'battery' THEN 'battery'
    WHEN LOWER(`title`) IN ('hard drive', 'hdd', 'ssd') THEN 'hard_drive'
    ELSE `measurement_type`
END;

UPDATE `maintenance_run_items`
SET `measurement_type` = CASE
    WHEN LOWER(`title`) = 'battery' THEN 'battery'
    WHEN LOWER(`title`) IN ('hard drive', 'hdd', 'ssd') THEN 'hard_drive'
    ELSE `measurement_type`
END;

-- Evidence upload is optional on every maintenance checklist item.
UPDATE `checklist_items` SET `evidence_required` = false WHERE `evidence_required` = true;
UPDATE `maintenance_run_items` SET `evidence_required` = false WHERE `evidence_required` = true;

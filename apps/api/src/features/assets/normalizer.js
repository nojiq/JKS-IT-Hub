const scalar = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object") return null;
  return String(value).trim() || null;
};

const objectName = (value) => {
  if (!value || typeof value !== "object") return scalar(value);
  return scalar(value.name);
};

const intValue = (value) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

const assignedType = (assignedTo) => {
  const rawType = scalar(assignedTo?.type);
  if (rawType) return rawType.toLowerCase();
  if (assignedTo?.username || assignedTo?.email) return "user";
  return null;
};

export const buildAssignmentFingerprint = ({
  snipeAssignedId,
  snipeAssignedType,
  snipeAssignedName,
  snipeAssignedUsername,
  snipeAssignedEmail
}) => {
  const values = [
    snipeAssignedType ?? "",
    snipeAssignedId ?? "",
    snipeAssignedUsername?.toLowerCase() ?? "",
    snipeAssignedEmail?.toLowerCase() ?? "",
    snipeAssignedName?.toLowerCase() ?? ""
  ];
  return values.some(Boolean) ? values.join("|") : null;
};

export const normalizeSnipeAsset = (row, syncedAt = new Date()) => {
  const assignedTo = row?.assigned_to && typeof row.assigned_to === "object" ? row.assigned_to : null;
  const normalized = {
    snipeAssetId: intValue(row?.id),
    assetTag: scalar(row?.asset_tag),
    name: scalar(row?.name),
    serial: scalar(row?.serial),
    modelName: objectName(row?.model),
    categoryName: objectName(row?.category),
    statusLabel: objectName(row?.status_label),
    snipeAssignedId: intValue(assignedTo?.id),
    snipeAssignedType: assignedType(assignedTo),
    snipeAssignedName: scalar(assignedTo?.name),
    snipeAssignedUsername: scalar(assignedTo?.username),
    snipeAssignedEmail: scalar(assignedTo?.email),
    lastSyncedAt: syncedAt
  };

  if (!normalized.snipeAssetId || !normalized.assetTag) {
    const error = new Error("Snipe asset row missing id or asset_tag");
    error.row = row;
    throw error;
  }

  normalized.assignmentFingerprint = buildAssignmentFingerprint(normalized);
  return normalized;
};

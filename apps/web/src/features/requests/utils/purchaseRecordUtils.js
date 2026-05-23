import { buildApiUrl } from "../../../shared/utils/api-client.js";

export const EMPTY_PURCHASE_ITEM = {
    itemName: "",
    description: "",
    category: "",
    quantity: 1,
    unitCost: "",
    marketplaceSource: null
};

export const getPrimaryItem = (record) => record?.items?.[0] ?? null;

export const getPrimaryItemName = (record) => {
    const item = getPrimaryItem(record);
    if (item?.itemName) return item.itemName;
    return record?.itemName ?? "Purchase record";
};

export const getPrimaryItemImageUrl = (record) => {
    const item = getPrimaryItem(record);
    return getPurchaseItemImageUrl(item);
};

export const resolveUploadUrl = (url) => {
    if (!url) return null;
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    if (url.startsWith("/api/")) {
        const resolved = buildApiUrl(url);
        if (resolved !== url) return resolved;

        const location = globalThis.window?.location;
        const isLocalVite = location
            && ["localhost", "127.0.0.1"].includes(location.hostname)
            && /^517\d$/.test(location.port);
        if (isLocalVite) return `http://${location.hostname}:3006${url}`;
    }
    return url;
};

export const getPurchaseItemImageUrl = (item) => (
    resolveUploadUrl(item?.imageFileUrl ?? item?.sourceImageUrl ?? null)
);

export const getItemCountLabel = (record) => {
    const count = record?.items?.length ?? 0;
    if (count <= 1) return "1 item";
    return `${count} items`;
};

export const deriveLegacyStatus = (record) => {
    if (!record) return null;
    if (record.status) return record.status;
    if (record.recordStatus === "REJECTED") return "REJECTED";
    if (record.approvalStatus === "APPROVED") return "APPROVED";
    if (record.approvalStatus === "REJECTED") return "REJECTED";
    if (record.approvalStatus === "SKIPPED") return "ALREADY_PURCHASED";
    if (record.approvalStatus === "PENDING") return "IT_REVIEWED";
    return "SUBMITTED";
};

const LEGACY_STATUS_LABELS = {
    SUBMITTED: "Submitted",
    IT_REVIEWED: "IT Reviewed",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    ALREADY_PURCHASED: "Purchased"
};

export const formatLegacyStatusLabel = (record) => {
    const status = deriveLegacyStatus(record);
    if (!status) return "Unknown";
    return LEGACY_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
};

export const getRecordDisplayStatus = (record) => ({
    recordStatus: record?.recordStatus ?? "RECORDED",
    approvalStatus: record?.approvalStatus ?? "NOT_REQUIRED",
    legacyStatus: deriveLegacyStatus(record)
});

export const getRecordReason = (record) => record?.reason ?? record?.justification ?? "";

export const RECORD_STATUS_OPTIONS = [
    { value: "RECORDED", label: "Recorded" },
    { value: "REJECTED", label: "Rejected" },
    { value: "ARCHIVED", label: "Archived" }
];

export const APPROVAL_STATUS_OPTIONS = [
    { value: "NOT_REQUIRED", label: "No approval needed" },
    { value: "PENDING", label: "Pending approval" },
    { value: "APPROVED", label: "Approved" },
    { value: "SKIPPED", label: "Approval skipped" },
    { value: "REJECTED", label: "Approval rejected" }
];

export const SNIPE_TYPE_OPTIONS = [
    { value: "HARDWARE", label: "Hardware" },
    { value: "ACCESSORY", label: "Accessory" },
    { value: "CONSUMABLE", label: "Consumable" },
    { value: "LICENSE", label: "License" },
    { value: "COMPONENT", label: "Component" }
];

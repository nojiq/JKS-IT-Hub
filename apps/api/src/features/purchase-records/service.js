import { hasItRole } from "../../shared/auth/rbac.js";

const forbidden = (message) => {
  const error = new Error(message);
  error.name = "Forbidden";
  return error;
};

const notFound = (message) => {
  const error = new Error(message);
  error.name = "NotFound";
  return error;
};

const validation = (message) => {
  const error = new Error(message);
  error.name = "ValidationError";
  return error;
};

const mapLineTotal = (item) => {
  if (item.unitCost === undefined || item.unitCost === null || item.unitCost === "") return null;
  return (Number(item.unitCost) * Number(item.quantity || 1)).toFixed(2);
};

const displayNameFromSnipe = (entity) => {
  if (!entity) return null;
  return entity.name || entity.asset_tag || entity.serial || entity.model_number || entity.order_number || String(entity.id);
};

const mapMarketplaceSource = async (item, imageCache) => {
  const source = item.marketplaceSource;
  if (!source) {
    return {
      imageFileUrl: null,
      sourceUrl: null,
      sourceMarketplace: null,
      sourceImageUrl: null,
      sourceSnapshot: null
    };
  }

  const sourceImageUrl = source.imageUrl ?? null;
  const imageFileUrl = sourceImageUrl && imageCache?.cacheRemoteProductImage
    ? await imageCache.cacheRemoteProductImage(sourceImageUrl)
    : null;

  return {
    imageFileUrl,
    sourceUrl: source.sourceUrl ?? null,
    sourceMarketplace: source.marketplace ?? null,
    sourceImageUrl,
    sourceSnapshot: source.snapshot ?? null
  };
};

export const createPurchaseRecordsService = ({ repo, auditRepo, snipeClient, imageCache, now = () => new Date() }) => {
  const createPurchaseRecord = async (data, actorUser) => {
    if (actorUser.status === "disabled") {
      throw forbidden("Cannot submit purchase records with a disabled account");
    }

    const itemCreates = await Promise.all(data.items.map(async (item) => ({
      itemName: item.itemName,
      description: item.description ?? null,
      category: item.category ?? null,
      quantity: item.quantity ?? 1,
      unitCost: item.unitCost ?? null,
      lineTotal: mapLineTotal(item),
      ...(await mapMarketplaceSource(item, imageCache)),
      snipeType: item.snipeType ?? null,
      snipeId: item.snipeId ?? null,
      snipeVerificationStatus: item.snipeId ? "UNVERIFIED" : "UNVERIFIED"
    })));

    const record = await repo.createPurchaseRecord({
      requesterId: actorUser.id,
      requestedForUserId: data.requestedForUserId ?? null,
      reason: data.reason,
      invoiceFileUrl: data.invoiceFileUrl ?? null,
      recordedById: actorUser.id,
      purchasedById: data.purchasedById ?? null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      vendorName: data.vendorName ?? null,
      totalAmount: data.totalAmount ?? null,
      currency: data.currency ?? "MYR",
      notes: data.notes ?? null,
      recordStatus: data.approvalStatus === "REJECTED" ? "REJECTED" : "RECORDED",
      approvalStatus: data.approvalStatus ?? "NOT_REQUIRED",
      approvalSkipReason: data.approvalSkipReason ?? null,
      approvalNote: data.approvalNote ?? null,
      items: { create: itemCreates }
    });

    await auditRepo?.createAuditLog?.({
      action: "purchase_record_created",
      actorUserId: actorUser.id,
      entityType: "PurchaseRecord",
      entityId: record.id,
      metadata: { itemCount: record.items?.length ?? 0 }
    }).catch(() => {});

    return record;
  };

  const listPurchaseRecords = (filters, pagination, actorUser) => {
    if (!hasItRole(actorUser)) {
      return repo.listPurchaseRecords({ ...filters, requesterId: actorUser.id }, pagination);
    }
    return repo.listPurchaseRecords(filters, pagination);
  };

  const getPurchaseRecordDetails = async (id, actorUser) => {
    const record = await repo.getPurchaseRecordById(id);
    if (!record) return null;
    if (record.requesterId !== actorUser.id && !hasItRole(actorUser)) {
      throw forbidden("You do not have permission to view this purchase record");
    }
    return record;
  };

  const verifyPurchaseRecordItemInSnipe = async (recordId, itemId, data, actorUser) => {
    if (!hasItRole(actorUser)) {
      throw forbidden("Only IT staff can verify Snipe-IT links");
    }

    const record = await repo.getPurchaseRecordById(recordId);
    if (!record) throw notFound("Purchase record not found");
    const item = record.items?.find((entry) => entry.id === itemId);
    if (!item) throw notFound("Purchase record item not found");
    if (!snipeClient?.fetchSnipeEntity) throw validation("Snipe-IT verification is not configured");

    try {
      const entity = await snipeClient.fetchSnipeEntity(data.snipeType, data.snipeId);
      const update = entity
        ? {
            snipeType: data.snipeType,
            snipeId: data.snipeId,
            snipeDisplayName: displayNameFromSnipe(entity),
            snipeVerifiedAt: now(),
            snipeSnapshot: entity,
            snipeVerificationStatus: "VERIFIED"
          }
        : {
            snipeType: data.snipeType,
            snipeId: data.snipeId,
            snipeDisplayName: null,
            snipeVerifiedAt: now(),
            snipeSnapshot: null,
            snipeVerificationStatus: "NOT_FOUND"
          };

      const updated = await repo.updatePurchaseRecordItemSnipeVerification(itemId, update);
      await auditRepo?.createAuditLog?.({
        action: "purchase_record_item_snipe_verified",
        actorUserId: actorUser.id,
        entityType: "PurchaseRecordItem",
        entityId: itemId,
        metadata: { recordId, snipeType: data.snipeType, snipeId: data.snipeId, status: update.snipeVerificationStatus }
      }).catch(() => {});
      return updated;
    } catch (error) {
      if (error.name === "NotFound" || error.name === "Forbidden" || error.name === "ValidationError") throw error;
      return repo.updatePurchaseRecordItemSnipeVerification(itemId, {
        snipeType: data.snipeType,
        snipeId: data.snipeId,
        snipeDisplayName: null,
        snipeVerifiedAt: now(),
        snipeSnapshot: { error: error.message },
        snipeVerificationStatus: "ERROR"
      });
    }
  };

  return {
    createPurchaseRecord,
    listPurchaseRecords,
    getPurchaseRecordDetails,
    verifyPurchaseRecordItemInSnipe
  };
};

import { prisma } from "../../shared/db/prisma.js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTED_SECRET_PREFIX = "enc:v1";
const ENCRYPTED_SECRET_PATTERN = /^enc:v1:([^:]+):([^:]+):(.+)$/;
let cachedEncryptionKey = null;

const getEncryptionKey = () => {
  if (cachedEncryptionKey) {
    return cachedEncryptionKey;
  }

  const source =
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.AUTH_JWT_SECRET;

  if (!source) {
    throw new Error(
      "Missing credential encryption key. Set CREDENTIAL_ENCRYPTION_KEY (preferred) or JWT_SECRET."
    );
  }

  cachedEncryptionKey = createHash("sha256").update(source).digest();
  return cachedEncryptionKey;
};

const isEncryptedSecret = (value) => {
  return typeof value === "string" && value.startsWith(`${ENCRYPTED_SECRET_PREFIX}:`);
};

const encryptSecret = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (isEncryptedSecret(value)) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_SECRET_PREFIX}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
};

const decryptSecret = (value) => {
  if (typeof value !== "string" || !isEncryptedSecret(value)) {
    return value;
  }

  const parts = value.match(ENCRYPTED_SECRET_PATTERN);
  if (!parts) {
    return value;
  }

  const [, ivBase64, tagBase64, ciphertextBase64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivBase64, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, "base64url")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
};

const mapBundle = (bundle) => ({
  id: bundle.id,
  department: bundle.department,
  isActive: bundle.isActive,
  createdAt: bundle.createdAt,
  updatedAt: bundle.updatedAt,
  catalogItemKeys: bundle.items
    .slice()
    .sort((left, right) => left.position - right.position)
    .map((item) => item.catalogItem.itemKey)
});

const mapDraftCredential = (credential) => ({
  ...credential,
  password: decryptSecret(credential.password),
  itemKey: credential.catalogItem?.itemKey ?? null,
  label: credential.catalogItem?.label ?? null,
  loginUrl: credential.catalogItem?.loginUrl ?? null,
  notes: credential.catalogItem?.notes ?? null
});

const mapDraft = (draft) => ({
  ...draft,
  credentials: (draft.credentials ?? []).map(mapDraftCredential)
});

export const listCatalogItems = async (tx = prisma) => {
  return tx.onboardingCatalogItem.findMany({
    orderBy: [{ label: "asc" }, { itemKey: "asc" }]
  });
};

export const getCatalogItemById = async (id, tx = prisma) => {
  return tx.onboardingCatalogItem.findUnique({ where: { id } });
};

export const getCatalogItemByKey = async (itemKey, tx = prisma) => {
  return tx.onboardingCatalogItem.findUnique({ where: { itemKey } });
};

export const getCatalogItemsByKeys = async (itemKeys = [], tx = prisma) => {
  const uniqueKeys = [...new Set(itemKeys.filter(Boolean))];
  if (!uniqueKeys.length) {
    return [];
  }

  return tx.onboardingCatalogItem.findMany({
    where: { itemKey: { in: uniqueKeys } }
  });
};

export const createCatalogItem = async (data, tx = prisma) => {
  return tx.onboardingCatalogItem.create({ data });
};

export const updateCatalogItem = async (id, data, tx = prisma) => {
  return tx.onboardingCatalogItem.update({
    where: { id },
    data
  });
};

export const deleteCatalogItem = async (id, tx = prisma) => {
  return tx.onboardingCatalogItem.delete({ where: { id } });
};

export const listDepartmentBundles = async (tx = prisma) => {
  const bundles = await tx.onboardingDepartmentBundle.findMany({
    include: {
      items: {
        include: {
          catalogItem: true
        }
      }
    },
    orderBy: [{ department: "asc" }]
  });

  return bundles.map(mapBundle);
};

export const getDepartmentBundleByDepartment = async (department, tx = prisma) => {
  const bundle = await tx.onboardingDepartmentBundle.findFirst({
    where: {
      department,
      isActive: true
    },
    include: {
      items: {
        include: {
          catalogItem: true
        }
      }
    }
  });

  return bundle ? mapBundle(bundle) : null;
};

export const getDepartmentBundleById = async (id, tx = prisma) => {
  const bundle = await tx.onboardingDepartmentBundle.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          catalogItem: true
        }
      }
    }
  });

  return bundle ? mapBundle(bundle) : null;
};

const resolveCatalogItemsForBundle = async (catalogItemKeys, tx) => {
  const catalogItems = await getCatalogItemsByKeys(catalogItemKeys, tx);
  const itemMap = new Map(catalogItems.map((item) => [item.itemKey, item]));

  return catalogItemKeys.map((itemKey, index) => ({
    itemKey,
    position: index,
    catalogItemId: itemMap.get(itemKey)?.id ?? null
  }));
};

export const createDepartmentBundle = async ({ department, catalogItemKeys, isActive, createdById }, tx = prisma) => {
  const resolvedItems = await resolveCatalogItemsForBundle(catalogItemKeys, tx);

  return tx.$transaction(async (innerTx) => {
    const bundle = await innerTx.onboardingDepartmentBundle.create({
      data: {
        department,
        isActive,
        createdById
      }
    });

    await innerTx.onboardingDepartmentBundleItem.createMany({
      data: resolvedItems.map((item) => ({
        bundleId: bundle.id,
        catalogItemId: item.catalogItemId,
        position: item.position
      }))
    });

    const stored = await innerTx.onboardingDepartmentBundle.findUnique({
      where: { id: bundle.id },
      include: {
        items: {
          include: {
            catalogItem: true
          }
        }
      }
    });

    return mapBundle(stored);
  });
};

export const updateDepartmentBundle = async (id, { department, catalogItemKeys, isActive }, tx = prisma) => {
  return tx.$transaction(async (innerTx) => {
    const nextBundle = await innerTx.onboardingDepartmentBundle.update({
      where: { id },
      data: {
        ...(department !== undefined ? { department } : {}),
        ...(isActive !== undefined ? { isActive } : {})
      }
    });

    if (catalogItemKeys !== undefined) {
      const resolvedItems = await resolveCatalogItemsForBundle(catalogItemKeys, innerTx);
      await innerTx.onboardingDepartmentBundleItem.deleteMany({
        where: { bundleId: id }
      });
      await innerTx.onboardingDepartmentBundleItem.createMany({
        data: resolvedItems.map((item) => ({
          bundleId: id,
          catalogItemId: item.catalogItemId,
          position: item.position
        }))
      });
    }

    const stored = await innerTx.onboardingDepartmentBundle.findUnique({
      where: { id: nextBundle.id },
      include: {
        items: {
          include: {
            catalogItem: true
          }
        }
      }
    });

    return mapBundle(stored);
  });
};

export const deleteDepartmentBundle = async (id, tx = prisma) => {
  return tx.onboardingDepartmentBundle.delete({ where: { id } });
};

export const listManagedDepartments = async (tx = prisma) => {
  const bundles = await tx.onboardingDepartmentBundle.findMany({
    where: { isActive: true },
    select: { department: true },
    orderBy: { department: "asc" }
  });

  return bundles.map((bundle) => bundle.department);
};

export const listDirectoryUsers = async (search, tx = prisma) => {
  const where = search
    ? {
        OR: [
          { username: { contains: search } },
          {
            ldapAttributes: {
              path: "$.displayName",
              string_contains: search
            }
          },
          {
            ldapAttributes: {
              path: "$.department",
              string_contains: search
            }
          }
        ]
      }
    : {};

  return tx.user.findMany({
    where,
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      status: true,
      ldapAttributes: true
    }
  });
};

export const createOnboardingDraft = async (data, tx = prisma) => {
  return tx.onboardingDraft.create({ data });
};

export const getOnboardingDraftById = async (id, tx = prisma) => {
  const draft = await tx.onboardingDraft.findUnique({
    where: { id },
    include: {
      credentials: {
        where: { isActive: true },
        include: {
          catalogItem: true
        },
        orderBy: {
          catalogItem: { label: "asc" }
        }
      }
    }
  });

  if (!draft) {
    return null;
  }

  return mapDraft(draft);
};

export const listOnboardingDrafts = async (status = "all", tx = prisma) => {
  const where = {};

  if (status === "linked") {
    where.linkedUserId = { not: null };
  } else if (status === "unlinked") {
    where.linkedUserId = null;
  }

  const drafts = await tx.onboardingDraft.findMany({
    where,
    include: {
      credentials: {
        where: { isActive: true },
        include: {
          catalogItem: true
        },
        orderBy: {
          catalogItem: { label: "asc" }
        }
      }
    },
    orderBy: [{ linkedAt: "desc" }, { createdAt: "desc" }]
  });

  return drafts.map(mapDraft);
};

export const updateOnboardingDraft = async (id, data, tx = prisma) => {
  return tx.onboardingDraft.update({
    where: { id },
    data
  });
};

export const linkOnboardingDraft = async (id, userId, tx = prisma) => {
  return tx.onboardingDraft.update({
    where: { id },
    data: {
      linkedUserId: userId,
      linkedAt: new Date()
    }
  });
};

export const getActiveDraftCredential = async (draftId, catalogItemId, tx = prisma) => {
  const credential = await tx.onboardingDraftCredential.findFirst({
    where: {
      draftId,
      catalogItemId,
      isActive: true
    },
    include: {
      catalogItem: true
    }
  });

  return credential ? mapDraftCredential(credential) : null;
};

export const deactivateDraftCredential = async (id, tx = prisma) => {
  return tx.onboardingDraftCredential.update({
    where: { id },
    data: { isActive: false }
  });
};

export const createOnboardingDraftCredential = async (data, tx = prisma) => {
  const credential = await tx.onboardingDraftCredential.create({
    data: {
      ...data,
      password: encryptSecret(data.password)
    },
    include: {
      catalogItem: true
    }
  });

  return mapDraftCredential(credential);
};

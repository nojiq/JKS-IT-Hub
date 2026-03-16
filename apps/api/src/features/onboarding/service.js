import { prisma } from "../../shared/db/prisma.js";
import * as repo from "./repo.js";
import * as userRepo from "../users/repo.js";
import * as credentialRepo from "../credentials/repo.js";
import * as credentialService from "../credentials/service.js";
import { OnboardingNotFoundError, OnboardingValidationError } from "./errors.js";

const trimToNull = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const getAttributeValue = (attributes, keys = []) => {
  if (!attributes || typeof attributes !== "object") {
    return "";
  }

  const entries = Object.entries(attributes);

  for (const key of keys) {
    const directValue = attributes[key];
    if (directValue !== undefined && directValue !== null && directValue !== "") {
      return Array.isArray(directValue) ? directValue[0] : directValue;
    }

    const lowerKey = String(key).toLowerCase();
    const matchedEntry = entries.find(([entryKey]) => entryKey.toLowerCase() === lowerKey);
    if (matchedEntry && matchedEntry[1] !== undefined && matchedEntry[1] !== null && matchedEntry[1] !== "") {
      return Array.isArray(matchedEntry[1]) ? matchedEntry[1][0] : matchedEntry[1];
    }
  }

  return "";
};

const deriveNameParts = (fullName) => {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    givenName: parts[0] ?? "",
    surname: parts.slice(1).join(" ")
  };
};

const buildDirectoryUserSummary = (user) => {
  const ldapAttributes = user.ldapAttributes ?? {};
  const displayName =
    trimToNull(getAttributeValue(ldapAttributes, ["displayName", "cn", "name"])) ?? user.username;
  const email =
    trimToNull(getAttributeValue(ldapAttributes, ["mail", "email", "userPrincipalName"])) ??
    `${user.username}@jkseng.com`;
  const department = trimToNull(getAttributeValue(ldapAttributes, ["department", "dept"])) ?? "";

  return {
    id: user.id,
    username: user.username,
    status: user.status,
    displayName,
    email,
    department
  };
};

const buildManualIdentity = (manualIdentity, draftId = null) => {
  const fullName = manualIdentity.fullName.trim();
  const email = manualIdentity.email.trim().toLowerCase();
  const department = manualIdentity.department.trim();
  const { givenName, surname } = deriveNameParts(fullName);

  return {
    id: draftId ?? `manual:${email}`,
    username: email.split("@")[0],
    status: "active",
    ldapAttributes: {
      cn: fullName,
      displayName: fullName,
      mail: email,
      department,
      givenName,
      sn: surname
    }
  };
};

const buildExistingIdentity = (user) => {
  const summary = buildDirectoryUserSummary(user);
  const ldapAttributes = {
    ...(user.ldapAttributes ?? {})
  };
  const { givenName, surname } = deriveNameParts(summary.displayName);

  return {
    id: user.id,
    username: user.username,
    status: user.status,
    ldapAttributes: {
      ...ldapAttributes,
      cn: ldapAttributes.cn ?? summary.displayName,
      displayName: ldapAttributes.displayName ?? summary.displayName,
      mail: ldapAttributes.mail ?? summary.email,
      department: ldapAttributes.department ?? summary.department,
      givenName: ldapAttributes.givenName ?? givenName,
      sn: ldapAttributes.sn ?? surname
    }
  };
};

const createPreviewToken = () => {
  return `onboarding_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

const buildSetupSheet = (catalogItems, credentials) => {
  const itemMap = new Map(catalogItems.map((item) => [item.itemKey, item]));
  return {
    entries: credentials.map((credential) => {
      const catalogItem = itemMap.get(credential.system);
      return {
        systemId: credential.system,
        label: catalogItem?.label ?? credential.system,
        loginUrl: catalogItem?.loginUrl ?? "",
        username: credential.username,
        password: credential.password,
        notes: catalogItem?.notes ?? ""
      };
    })
  };
};

const buildDraftStatus = (draft) => {
  return draft.linkedUserId ? "completed" : "draft";
};

const buildDraftSummary = (draft) => ({
  id: draft.id,
  fullName: draft.fullName,
  email: draft.email,
  department: draft.department,
  createdAt: draft.createdAt,
  linkedUserId: draft.linkedUserId,
  linkedAt: draft.linkedAt,
  status: buildDraftStatus(draft),
  selectedCatalogItemKeys: (draft.credentials ?? []).map((credential) => credential.itemKey).filter(Boolean),
  setupSheet: {
    entries: (draft.credentials ?? []).map((credential) => ({
      systemId: credential.itemKey ?? credential.catalogItem?.itemKey ?? credential.catalogItemId,
      label: credential.label ?? credential.catalogItem?.label ?? credential.itemKey,
      loginUrl: credential.loginUrl ?? credential.catalogItem?.loginUrl ?? "",
      username: credential.username,
      password: credential.password,
      notes: credential.notes ?? credential.catalogItem?.notes ?? ""
    }))
  }
});

const createPreviewRepo = (template, identity) => ({
  getActiveCredentialTemplate: async () => template,
  getUserById: async (id) => (id === identity.id ? identity : null)
});

const resolveSelectedCatalogItems = async (selectedCatalogItemKeys) => {
  const catalogItems = await repo.getCatalogItemsByKeys(selectedCatalogItemKeys);
  const catalogItemMap = new Map(catalogItems.map((item) => [item.itemKey, item]));
  const missingKeys = selectedCatalogItemKeys.filter((key) => !catalogItemMap.has(key));

  if (missingKeys.length > 0) {
    throw new OnboardingValidationError("Some onboarding catalog items are missing", {
      missingCatalogItemKeys: missingKeys
    });
  }

  return selectedCatalogItemKeys.map((key) => catalogItemMap.get(key));
};

const saveExistingUserCredentials = async (performedByUserId, previewSession) => {
  return prisma.$transaction(async (tx) => {
    const createdCredentials = [];

    for (const credential of previewSession.credentials) {
      const existing = await credentialRepo.getUserCredentialBySystem(
        previewSession.source.userId,
        credential.system,
        tx
      );

      if (existing) {
        await credentialRepo.deactivateUserCredential(existing.id, tx);
      }

      const created = await credentialRepo.createUserCredential(
        {
          userId: previewSession.source.userId,
          systemId: credential.system,
          username: credential.username,
          password: credential.password,
          templateVersion: credential.templateVersion ?? previewSession.templateVersion,
          generatedBy: performedByUserId
        },
        tx
      );

      await credentialRepo.createCredentialVersion(
        {
          credentialId: created.id,
          username: credential.username,
          password: credential.password,
          reason: "initial",
          createdBy: performedByUserId
        },
        tx
      );

      createdCredentials.push(created);
    }

    return {
      userId: previewSession.source.userId,
      credentials: createdCredentials
    };
  });
};

const saveDraftCredentials = async (performedByUserId, previewSession) => {
  return prisma.$transaction(async (tx) => {
    const manualIdentity = previewSession.source.manualIdentity;
    const draft = previewSession.source.draftId
      ? await repo.updateOnboardingDraft(
          previewSession.source.draftId,
          {
            fullName: manualIdentity.fullName,
            email: manualIdentity.email.toLowerCase(),
            department: manualIdentity.department
          },
          tx
        )
      : await repo.createOnboardingDraft(
          {
            fullName: manualIdentity.fullName,
            email: manualIdentity.email.toLowerCase(),
            department: manualIdentity.department,
            createdById: performedByUserId
          },
          tx
        );

    const catalogItems = await repo.getCatalogItemsByKeys(previewSession.selectedCatalogItemKeys, tx);
    const catalogItemMap = new Map(catalogItems.map((item) => [item.itemKey, item]));
    const createdCredentials = [];

    for (const credential of previewSession.credentials) {
      const catalogItem = catalogItemMap.get(credential.system);
      const existing = await repo.getActiveDraftCredential(draft.id, catalogItem.id, tx);

      if (existing) {
        await repo.deactivateDraftCredential(existing.id, tx);
      }

      const created = await repo.createOnboardingDraftCredential(
        {
          draftId: draft.id,
          catalogItemId: catalogItem.id,
          username: credential.username,
          password: credential.password,
          templateVersion: credential.templateVersion ?? previewSession.templateVersion,
          createdById: performedByUserId
        },
        tx
      );

      createdCredentials.push(created);
    }

    return {
      draftId: draft.id,
      credentials: createdCredentials
    };
  });
};

export const listCatalogItems = async () => {
  return repo.listCatalogItems();
};

export const createCatalogItem = async (data, actorUserId) => {
  return repo.createCatalogItem({
    ...data,
    itemKey: data.itemKey.trim(),
    label: data.label.trim(),
    loginUrl: data.loginUrl.trim(),
    notes: trimToNull(data.notes),
    createdById: actorUserId
  });
};

export const updateCatalogItem = async (id, data) => {
  const existing = await repo.getCatalogItemById(id);
  if (!existing) {
    throw new OnboardingNotFoundError("Catalog item not found");
  }

  return repo.updateCatalogItem(id, {
    ...(data.itemKey !== undefined ? { itemKey: data.itemKey.trim() } : {}),
    ...(data.label !== undefined ? { label: data.label.trim() } : {}),
    ...(data.loginUrl !== undefined ? { loginUrl: data.loginUrl.trim() } : {}),
    ...(data.notes !== undefined ? { notes: trimToNull(data.notes) } : {}),
    ...(data.isItOnly !== undefined ? { isItOnly: data.isItOnly } : {})
  });
};

export const deleteCatalogItem = async (id) => {
  const existing = await repo.getCatalogItemById(id);
  if (!existing) {
    throw new OnboardingNotFoundError("Catalog item not found");
  }

  return repo.deleteCatalogItem(id);
};

export const listDepartmentBundles = async () => {
  return repo.listDepartmentBundles();
};

export const createDepartmentBundle = async (data, actorUserId) => {
  await resolveSelectedCatalogItems(data.catalogItemKeys);
  return repo.createDepartmentBundle({
    department: data.department.trim(),
    catalogItemKeys: data.catalogItemKeys,
    isActive: data.isActive,
    createdById: actorUserId
  });
};

export const updateDepartmentBundle = async (id, data) => {
  const existing = await repo.getDepartmentBundleById(id);
  if (!existing) {
    throw new OnboardingNotFoundError("Department bundle not found");
  }

  if (data.catalogItemKeys) {
    await resolveSelectedCatalogItems(data.catalogItemKeys);
  }

  return repo.updateDepartmentBundle(id, {
    ...(data.department !== undefined ? { department: data.department.trim() } : {}),
    ...(data.catalogItemKeys !== undefined ? { catalogItemKeys: data.catalogItemKeys } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {})
  });
};

export const deleteDepartmentBundle = async (id) => {
  const existing = await repo.getDepartmentBundleById(id);
  if (!existing) {
    throw new OnboardingNotFoundError("Department bundle not found");
  }

  return repo.deleteDepartmentBundle(id);
};

export const listManagedDepartments = async () => {
  return repo.listManagedDepartments();
};

export const listDirectoryUsers = async ({ search } = {}) => {
  const users = await repo.listDirectoryUsers(search);
  return users.map(buildDirectoryUserSummary);
};

export const getOnboardingDraft = async (draftId) => {
  const draft = await repo.getOnboardingDraftById(draftId);
  if (!draft) {
    throw new OnboardingNotFoundError("Onboarding draft not found");
  }

  return buildDraftSummary(draft);
};

export const listOnboardingDrafts = async ({ status = "all" } = {}) => {
  const drafts = await repo.listOnboardingDrafts(status);
  return drafts.map(buildDraftSummary);
};

export const previewOnboardingSetup = async (input) => {
  const catalogItems = await resolveSelectedCatalogItems(input.selectedCatalogItemKeys);
  const activeTemplate = await credentialRepo.getActiveCredentialTemplate();

  if (!activeTemplate) {
    throw new OnboardingValidationError("No active onboarding defaults found");
  }

  let source;
  let department;
  let identity;

  if (input.mode === "existing_user") {
    const existingUser = await userRepo.findUserById(input.userId);
    if (!existingUser) {
      throw new OnboardingNotFoundError("Directory user not found");
    }

    if (userRepo.isUserDisabled(existingUser)) {
      throw new OnboardingValidationError("Disabled users cannot enter onboarding setup");
    }

    const summary = buildDirectoryUserSummary(existingUser);
    department = summary.department;
    identity = buildExistingIdentity(existingUser);
    source = {
      mode: "existing_user",
      userId: existingUser.id,
      username: existingUser.username,
      department
    };
  } else {
    department = input.manualIdentity.department.trim();
    identity = buildManualIdentity(input.manualIdentity, input.draftId ?? null);
    source = {
      mode: "manual",
      draftId: input.draftId ?? null,
      department,
      manualIdentity: {
        fullName: input.manualIdentity.fullName.trim(),
        email: input.manualIdentity.email.trim().toLowerCase(),
        department
      }
    };
  }

  const recommendedBundle = department
    ? await repo.getDepartmentBundleByDepartment(department)
    : null;
  const recommendedItemKeys = recommendedBundle?.catalogItemKeys ?? [];
  const onboardingTemplate = {
    ...activeTemplate,
    structure: {
      ...activeTemplate.structure,
      systems: input.selectedCatalogItemKeys
    }
  };

  const preview = await credentialService.previewUserCredentials(identity.id, null, {
    repo: createPreviewRepo(onboardingTemplate, identity),
    userRepo: {
      isUserDisabled: () => false
    }
  });

  if (!preview.success) {
    throw new OnboardingValidationError(preview.error?.message ?? "Unable to preview onboarding setup", {
      error: preview.error
    });
  }

  const previewToken = createPreviewToken();
  const setupSheet = buildSetupSheet(catalogItems, preview.credentials);

  await credentialRepo.storePreviewSession(previewToken, {
    type: "onboarding",
    source,
    selectedCatalogItemKeys: input.selectedCatalogItemKeys,
    recommendedItemKeys,
    credentials: preview.credentials,
    templateVersion: preview.templateVersion,
    setupSheet,
    generatedAt: new Date().toISOString()
  });

  return {
    previewToken,
    source,
    recommendedItemKeys,
    setupSheet
  };
};

export const confirmOnboardingSetup = async (performedByUserId, { previewToken }) => {
  const previewSession = await credentialRepo.getPreviewSession(previewToken);
  if (!previewSession || previewSession.type !== "onboarding") {
    throw new OnboardingNotFoundError("Onboarding preview session has expired");
  }

  let persisted;
  if (previewSession.source.mode === "existing_user") {
    persisted = await saveExistingUserCredentials(performedByUserId, previewSession);
  } else {
    persisted = await saveDraftCredentials(performedByUserId, previewSession);
  }

  await credentialRepo.deletePreviewSession(previewToken);

  return {
    ...persisted,
    source: previewSession.source,
    setupSheet: previewSession.setupSheet
  };
};

export const linkDraftToUser = async (draftId, userId) => {
  const [draft, user] = await Promise.all([
    repo.getOnboardingDraftById(draftId),
    userRepo.findUserById(userId)
  ]);

  if (!draft) {
    throw new OnboardingNotFoundError("Onboarding draft not found");
  }

  if (!user) {
    throw new OnboardingNotFoundError("Directory user not found");
  }

  return repo.linkOnboardingDraft(draftId, userId);
};

export const linkDraftToUserAndPromote = async (draftId, userId, deps = {}) => {
  const repoApi = deps.repo ?? repo;
  const userRepoApi = deps.userRepo ?? userRepo;
  const credentialRepoApi = deps.credentialRepo ?? credentialRepo;
  const prismaClient = deps.prisma ?? prisma;
  const performedByUserId = deps.performedByUserId ?? userId;

  const [draft, user] = await Promise.all([
    repoApi.getOnboardingDraftById(draftId),
    userRepoApi.findUserById(userId)
  ]);

  if (!draft) {
    throw new OnboardingNotFoundError("Onboarding draft not found");
  }

  if (!user) {
    throw new OnboardingNotFoundError("Directory user not found");
  }

  if (userRepoApi.isUserDisabled?.(user)) {
    throw new OnboardingValidationError("Disabled users cannot receive promoted onboarding credentials");
  }

  if (draft.linkedUserId) {
    throw new OnboardingValidationError("This onboarding draft has already been linked and promoted");
  }

  if (!draft.credentials?.length) {
    throw new OnboardingValidationError("This onboarding draft has no saved credentials to promote");
  }

  const promotedCredentials = await prismaClient.$transaction(async (tx) => {
    const createdCredentials = [];

    for (const draftCredential of draft.credentials) {
      const systemId = draftCredential.itemKey ?? draftCredential.catalogItem?.itemKey;
      if (!systemId) {
        continue;
      }

      const existing = await credentialRepoApi.getUserCredentialBySystem(userId, systemId, tx);
      if (existing) {
        await credentialRepoApi.deactivateUserCredential(existing.id, tx);
      }

      const created = await credentialRepoApi.createUserCredential(
        {
          userId,
          systemId,
          username: draftCredential.username,
          password: draftCredential.password,
          templateVersion: draftCredential.templateVersion,
          generatedBy: performedByUserId
        },
        tx
      );

      await credentialRepoApi.createCredentialVersion(
        {
          credentialId: created.id,
          username: draftCredential.username,
          password: draftCredential.password,
          reason: "initial",
          createdBy: performedByUserId
        },
        tx
      );

      createdCredentials.push({
        systemId,
        username: draftCredential.username,
        credentialId: created.id
      });
    }

    await repoApi.linkOnboardingDraft(draftId, userId, tx);
    return createdCredentials;
  });

  const linkedDraft = await repoApi.getOnboardingDraftById(draftId);

  return {
    draft: buildDraftSummary(linkedDraft),
    promotedCredentials,
    targetUser: buildDirectoryUserSummary(user)
  };
};

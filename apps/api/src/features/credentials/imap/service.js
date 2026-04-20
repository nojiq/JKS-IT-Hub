import { createHash } from "node:crypto";
import * as repo from "../repo.js";
import * as userRepo from "../../users/repo.js";
import { generateImapDeterministicPassword } from "../generator.js";

const IMAP_FIELDS = [
    { key: "email", ldapKey: "mail" },
    { key: "firstName", ldapKey: "givenName" },
    { key: "lastName", ldapKey: "sn" },
    { key: "fullName", ldapKey: "cn" },
    { key: "dob", ldapKey: "birthDate" },
    { key: "phone", ldapKey: "telephoneNumber" }
];

const normalizeImapValue = (field, value) => {
    if (value === null || value === undefined) {
        return "";
    }

    const normalized = String(value).trim();
    switch (field) {
        case "email":
            return normalized.toLowerCase();
        case "firstName":
        case "lastName":
        case "fullName":
            return normalized.replace(/\s+/g, " ").toLowerCase();
        case "phone":
            return normalized.replace(/\D+/g, "");
        default:
            return normalized;
    }
};

const fingerprintImapValue = (field, value) => {
    return createHash("sha256")
        .update(normalizeImapValue(field, value))
        .digest("hex")
        .slice(0, 16);
};

const getLdapFieldValue = (ldapAttributes = {}, ldapKey) => {
    return String(ldapAttributes?.[ldapKey] ?? "").trim();
};

const buildManualSubjectKey = (manualIdentity = {}) => {
    const fullName = normalizeImapValue("fullName", manualIdentity.fullName);
    const email = normalizeImapValue("email", manualIdentity.email);
    return `manual:${fullName}|${email}`;
};

const buildResolvedFields = ({ profile = null, ldapAttributes = {}, inputValues = {}, inputOrigins = {} }) => {
    return IMAP_FIELDS.reduce((state, field) => {
        const hasInput = Object.hasOwn(inputValues, field.key) && String(inputValues[field.key] ?? "").trim() !== "";
        const systemValue = String(profile?.[field.key] ?? "").trim();
        const ldapValue = getLdapFieldValue(ldapAttributes, field.ldapKey);

        let value = "";
        let source = "empty";

        if (hasInput) {
            value = String(inputValues[field.key] ?? "").trim();
            source = inputOrigins[field.key] === "ldap" ? "ldap" : "system";
        } else if (systemValue) {
            value = systemValue;
            source = "system";
        } else if (ldapValue) {
            value = ldapValue;
            source = "ldap";
        }

        state[field.key] = {
            value,
            source,
            systemValue: systemValue || null,
            ldapValue: ldapValue || null
        };
        return state;
    }, {});
};

const buildConflictRows = (profile, ldapAttributes = {}) => {
    if (!profile?.resolvedLdapFingerprints || typeof profile.resolvedLdapFingerprints !== "object") {
        return [];
    }

    return IMAP_FIELDS.reduce((conflicts, field) => {
        const systemValue = String(profile?.[field.key] ?? "").trim();
        if (!systemValue) {
            return conflicts;
        }

        const ldapValue = getLdapFieldValue(ldapAttributes, field.ldapKey);
        if (!ldapValue) {
            return conflicts;
        }

        const currentFingerprint = fingerprintImapValue(field.key, ldapValue);
        const previousFingerprint = profile.resolvedLdapFingerprints?.[field.key];

        if (previousFingerprint && previousFingerprint !== currentFingerprint) {
            conflicts.push({
                field: field.key,
                systemValue,
                ldapValue,
                currentLdapFingerprint: currentFingerprint,
                previousLdapFingerprint: previousFingerprint
            });
        }

        return conflicts;
    }, []);
};

const buildSelectedOrigins = (fields) => {
    return Object.fromEntries(
        IMAP_FIELDS.map(({ key }) => [
            key,
            fields[key]?.source === "ldap" ? "ldap" : "manual"
        ])
    );
};

const buildSnapshotInputs = (fields) => {
    return Object.fromEntries(
        IMAP_FIELDS.map(({ key }) => [key, fields[key]?.value || ""])
    );
};

const buildProfileUpdateData = ({ userId, subjectKey, fields, ldapAttributes = {}, actorUserId }) => {
    const data = {
        userId,
        deterministicSubjectKey: subjectKey,
        updatedBy: actorUserId,
        resolvedLdapFingerprints: {}
    };

    for (const { key, ldapKey } of IMAP_FIELDS) {
        data[key] = fields[key]?.source === "system" && fields[key]?.value
            ? fields[key].value
            : null;

        const ldapValue = getLdapFieldValue(ldapAttributes, ldapKey);
        if (ldapValue) {
            data.resolvedLdapFingerprints[key] = fingerprintImapValue(key, ldapValue);
        }
    }

    return data;
};

const buildUsername = ({ input, activeCredential, fields, manualIdentity }) => {
    return String(
        input.username ||
        activeCredential?.username ||
        fields.email?.value ||
        manualIdentity?.email ||
        ""
    ).trim();
};

const resolveUserContext = async (input, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    const userRepoApi = deps.userRepo ?? userRepo;

    if (input.userId) {
        const user = await repoApi.getUserById(input.userId);
        if (!user) {
            const error = new Error("User not found");
            error.code = "USER_NOT_FOUND";
            throw error;
        }

        return {
            user,
            profile: await repoApi.getUserImapProfile(input.userId)
        };
    }

    if (input.createUser) {
        const created = await userRepoApi.createUser({
            username: input.createUser.username || input.username || input.manualIdentity?.email?.split("@")[0],
            role: input.createUser.role || "requester",
            status: input.createUser.status || "active"
        });

        return {
            user: {
                ...created,
                ldapAttributes: null
            },
            profile: null
        };
    }

    return {
        user: null,
        profile: null
    };
};

export const loadImapWorkbench = async (userId, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    const user = await repoApi.getUserById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.code = "USER_NOT_FOUND";
        throw error;
    }

    const profile = await repoApi.getUserImapProfile(userId);
    const activeCredential = await repoApi.getUserCredentialBySystem(userId, "imap");
    const records = await repoApi.listImapCredentialRecords(userId);
    const fields = buildResolvedFields({
        profile,
        ldapAttributes: user.ldapAttributes || {}
    });

    return {
        user: {
            id: user.id,
            username: user.username,
            status: user.status
        },
        subjectKey: profile?.deterministicSubjectKey || user.id,
        fields,
        activeCredential,
        previousPasswordsCount: records.length,
        conflicts: buildConflictRows(profile, user.ldapAttributes || {})
    };
};

export const previewImapPassword = async (input, deps = {}) => {
    const { user, profile } = await resolveUserContext(input, deps);
    const activeCredential = user?.id
        ? await (deps.repo ?? repo).getUserCredentialBySystem(user.id, "imap")
        : null;

    const fields = buildResolvedFields({
        profile,
        ldapAttributes: user?.ldapAttributes || {},
        inputValues: input.inputs || {},
        inputOrigins: input.origins || {}
    });

    const subjectKey = user?.id
        ? profile?.deterministicSubjectKey || user.id
        : buildManualSubjectKey(input.manualIdentity);
    const username = buildUsername({
        input,
        activeCredential,
        fields,
        manualIdentity: input.manualIdentity
    });

    const metadata = generateImapDeterministicPassword({
        subjectKey,
        userId: user?.id,
        username,
        inputs: buildSnapshotInputs(fields),
        selectedFields: input.selectedFields || {},
        origins: buildSelectedOrigins(fields),
        previousMetadata: activeCredential?.metadata || null
    }).metadata;

    const password = generateImapDeterministicPassword({
        subjectKey,
        userId: user?.id,
        username,
        inputs: buildSnapshotInputs(fields),
        selectedFields: input.selectedFields || {},
        origins: buildSelectedOrigins(fields),
        previousMetadata: activeCredential?.metadata || null
    }).password;

    return {
        user: user
            ? { id: user.id, username: user.username, status: user.status }
            : null,
        subjectKey,
        fields,
        activeCredential,
        proposedCredential: {
            system: "imap",
            username,
            password
        },
        metadata: {
            ...metadata,
            sources: buildSelectedOrigins(fields)
        }
    };
};

export const saveImapPassword = async (input, actorUserId, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    const { user, profile } = await resolveUserContext(input, deps);

    if (!user?.id) {
        const error = new Error("User attachment required before save");
        error.code = "USER_REQUIRED";
        throw error;
    }

    const preview = await previewImapPassword(
        {
            ...input,
            userId: user.id
        },
        {
            ...deps,
            repo: {
                ...repoApi,
                getUserImapProfile: async () => profile ?? (await repoApi.getUserImapProfile(user.id)),
                getUserById: async () => user
            }
        }
    );

    await repoApi.upsertUserImapProfile(
        buildProfileUpdateData({
            userId: user.id,
            subjectKey: preview.subjectKey,
            fields: preview.fields,
            ldapAttributes: user.ldapAttributes || {},
            actorUserId
        })
    );

    const currentActive = await repoApi.getUserCredentialBySystem(user.id, "imap");
    const setActive = Boolean(input.setActive);

    if (setActive && currentActive?.id) {
        await repoApi.deactivateUserCredential(currentActive.id);
    }

    const record = await repoApi.createImapCredentialRecord({
        userId: user.id,
        systemId: "imap",
        username: preview.proposedCredential.username,
        password: preview.proposedCredential.password,
        templateVersion: currentActive?.templateVersion ?? 1,
        metadata: {
            saveMode: setActive ? "active" : "history_only",
            subjectKey: preview.subjectKey,
            selectedFields: preview.metadata.selectedFields,
            sources: preview.metadata.sources,
            imapSnapshot: {
                fields: buildSnapshotInputs(preview.fields)
            }
        },
        isActive: setActive,
        generatedBy: actorUserId
    });

    return {
        user,
        subjectKey: preview.subjectKey,
        record
    };
};

export const listPreviousImapPasswords = async (userId, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    return repoApi.listImapCredentialRecords(userId);
};

export const applyImapConflictResolution = async (input, actorUserId, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    const workbench = await loadImapWorkbench(input.userId, deps);
    const nextFields = { ...workbench.fields };

    for (const conflict of workbench.conflicts) {
        const decision = input.fields?.[conflict.field];
        if (decision === "use_ldap") {
            nextFields[conflict.field] = {
                ...nextFields[conflict.field],
                value: conflict.ldapValue,
                source: "ldap",
                systemValue: null
            };
        }
    }

    await repoApi.upsertUserImapProfile(
        buildProfileUpdateData({
            userId: input.userId,
            subjectKey: workbench.subjectKey,
            fields: nextFields,
            ldapAttributes: Object.fromEntries(
                IMAP_FIELDS.map(({ ldapKey, key }) => [ldapKey, workbench.fields[key]?.ldapValue || ""])
            ),
            actorUserId
        })
    );

    return loadImapWorkbench(input.userId, deps);
};

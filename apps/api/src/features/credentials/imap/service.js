import * as repo from "../repo.js";

const coerceMailString = (mail) => {
    if (mail == null || mail === "") {
        return "";
    }
    if (Array.isArray(mail)) {
        for (const entry of mail) {
            const s = String(entry ?? "").trim();
            if (s) {
                return s;
            }
        }
        return "";
    }
    if (typeof mail === "object") {
        return "";
    }
    return String(mail).trim();
};

const resolveImapUsername = (inputUsername, activeCredential, ldapAttributes = {}) => {
    const trimmed = String(inputUsername ?? "").trim();
    if (trimmed) {
        return trimmed;
    }
    const fromActive = String(activeCredential?.username ?? "").trim();
    if (fromActive) {
        return fromActive;
    }
    return coerceMailString(ldapAttributes.mail);
};

export const loadImapWorkbench = async (userId, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    const user = await repoApi.getUserById(userId);
    if (!user) {
        const error = new Error("User not found");
        error.code = "USER_NOT_FOUND";
        throw error;
    }

    const activeCredential = await repoApi.getUserCredentialBySystem(userId, "imap");
    const records = await repoApi.listImapCredentialRecords(userId);

    return {
        user: {
            id: user.id,
            username: user.username,
            status: user.status
        },
        activeCredential,
        previousPasswordsCount: records.length
    };
};

export const saveImapPassword = async (input, actorUserId, deps = {}) => {
    const repoApi = deps.repo ?? repo;

    if (!input.userId) {
        const error = new Error("userId is required");
        error.code = "USER_REQUIRED";
        throw error;
    }

    const user = await repoApi.getUserById(input.userId);
    if (!user) {
        const error = new Error("User not found");
        error.code = "USER_NOT_FOUND";
        throw error;
    }

    const currentActive = await repoApi.getUserCredentialBySystem(input.userId, "imap");
    const setActive = Boolean(input.setActive ?? true);

    let username;
    let password;
    let metadata;

    if (input.restoreCredentialId) {
        const restored = await repoApi.getUserCredentialById(input.restoreCredentialId);
        if (
            !restored
            || restored.userId !== input.userId
            || restored.systemId !== "imap"
        ) {
            const error = new Error("Credential not found");
            error.code = "CREDENTIAL_NOT_FOUND";
            throw error;
        }

        username = String(restored.username ?? "").trim();
        password = restored.password;
        metadata = {
            mode: "provider_recorded",
            saveMode: setActive ? "active" : "history_only",
            restoredFrom: restored.id
        };
    } else {
        password = String(input.password ?? "").trim();
        if (!password) {
            const error = new Error("Password is required");
            error.code = "PASSWORD_REQUIRED";
            throw error;
        }

        username = resolveImapUsername(input.username, currentActive, user.ldapAttributes || {});
        if (!username) {
            const error = new Error(
                "Username is required when the user has no saved IMAP username and no LDAP mail"
            );
            error.code = "USERNAME_REQUIRED";
            throw error;
        }

        metadata = {
            mode: "provider_recorded",
            saveMode: setActive ? "active" : "history_only"
        };
    }

    if (setActive && currentActive?.id) {
        await repoApi.deactivateUserCredential(currentActive.id);
    }

    const record = await repoApi.createImapCredentialRecord({
        userId: input.userId,
        systemId: "imap",
        username,
        password,
        templateVersion: currentActive?.templateVersion ?? 1,
        metadata,
        isActive: setActive,
        generatedBy: actorUserId
    });

    return {
        user,
        record
    };
};

export const listPreviousImapPasswords = async (userId, deps = {}) => {
    const repoApi = deps.repo ?? repo;
    return repoApi.listImapCredentialRecords(userId);
};

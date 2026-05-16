import test from "node:test";
import assert from "node:assert/strict";

test("linkDraftToUserAndPromote blocks repeated promotion for an already linked draft", async () => {
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    const { linkDraftToUserAndPromote } = await import("../../apps/api/src/features/onboarding/service.js");

    const repo = {
        getOnboardingDraftById: async () => ({
            id: "draft-1",
            fullName: "Haziq Afendi",
            email: "haziq.afendi@jkseng.com",
            department: "Business Development",
            linkedUserId: "user-1",
            linkedAt: "2026-03-14T10:15:00.000Z",
            credentials: []
        })
    };

    const userRepo = {
        findUserById: async () => ({
            id: "user-1",
            username: "haziq.afendi",
            status: "active",
            ldapAttributes: { mail: "haziq.afendi@jkseng.com" }
        }),
        isUserDisabled: () => false
    };

    await assert.rejects(
        () =>
            linkDraftToUserAndPromote("draft-1", "user-1", {
                repo,
                userRepo,
                prisma: {
                    $transaction: async (callback) => callback({})
                }
            }),
        (error) => {
            assert.equal(error.code, "ONBOARDING_VALIDATION");
            assert.match(error.message, /already been linked/i);
            return true;
        }
    );
});

test("getUserDepartment prefers Pulse org snapshot over LDAP department", async () => {
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    const { getUserDepartment } = await import("../../apps/api/src/features/onboarding/service.js");

    assert.equal(
        getUserDepartment({
            ldapAttributes: { department: "Legacy LDAP" },
            orgSnapshot: {
                department: { name: "IT" }
            }
        }),
        "IT"
    );

    assert.equal(
        getUserDepartment({
            ldapAttributes: { dept: "Finance" },
            orgSnapshot: null
        }),
        "Finance"
    );
});

test("createManualOnboardingUser creates real user from manual identity and reuses existing username", async () => {
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    const { createManualOnboardingUser } = await import("../../apps/api/src/features/onboarding/service.js");

    const createdUsers = [];
    const userRepo = {
        findUserByUsername: async (username) =>
            createdUsers.find((user) => user.username === username) ?? null,
        createUser: async (data) => {
            const user = { id: `user-${createdUsers.length + 1}`, ...data };
            createdUsers.push(user);
            return user;
        }
    };

    const first = await createManualOnboardingUser(
        {
            fullName: "Afendi Mohd",
            email: "  AfendiMohd@JKSENG.COM  ",
            department: "After Sales & Services",
            dob: "1998-04-30"
        },
        { userRepo }
    );
    const second = await createManualOnboardingUser(
        {
            fullName: "Afendi Mohd",
            email: "afendimohd@jkseng.com",
            department: "After Sales & Services",
            dob: "1998-04-30"
        },
        { userRepo }
    );

    assert.equal(first.id, "user-1");
    assert.equal(second.id, first.id);
    assert.equal(createdUsers.length, 1);
    assert.equal(createdUsers[0].username, "afendimohd");
    assert.equal(createdUsers[0].role, "requester");
    assert.equal(createdUsers[0].status, "active");
    assert.equal(createdUsers[0].ldapSyncedAt, null);
    assert.deepEqual(createdUsers[0].ldapAttributes, {
        cn: "Afendi Mohd",
        displayName: "Afendi Mohd",
        mail: "afendimohd@jkseng.com",
        department: "After Sales & Services",
        givenName: "Afendi",
        sn: "Mohd",
        samAccountName: "Afendimohd@7189",
        birthDate: "1998-04-30"
    });
});

test("createManualOnboardingUser assigns IT department users as technicians", async () => {
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    const { createManualOnboardingUser } = await import("../../apps/api/src/features/onboarding/service.js");

    let createdUser;
    const userRepo = {
        findUserByUsername: async () => null,
        createUser: async (data) => {
            createdUser = { id: "user-1", ...data };
            return createdUser;
        }
    };

    await createManualOnboardingUser(
        {
            fullName: "Izzat Ismail",
            email: "izzat.ismail@jkseng.com",
            department: "IT",
            dob: "1996-02-10"
        },
        { userRepo }
    );

    assert.equal(createdUser.role, "it");
});

test("confirmOnboardingSetup saves manual onboarding credentials to a real user", async () => {
    process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
    const { confirmOnboardingSetup } = await import("../../apps/api/src/features/onboarding/service.js");

    const createdUsers = [];
    const createdCredentials = [];
    const credentialVersions = [];
    const profileUpdates = [];
    let deletedPreviewToken = null;
    let draftCreated = false;

    const result = await confirmOnboardingSetup(
        "actor-1",
        { previewToken: "preview-1" },
        {
            userRepo: {
                findUserByUsername: async (username) =>
                    createdUsers.find((user) => user.username === username) ?? null,
                createUser: async (data) => {
                    const user = { id: `user-${createdUsers.length + 1}`, ...data };
                    createdUsers.push(user);
                    return user;
                }
            },
            credentialRepo: {
                getPreviewSession: async (token) => {
                    assert.equal(token, "preview-1");
                    return {
                        type: "onboarding",
                        source: {
                            mode: "manual",
                            manualIdentity: {
                                fullName: "Afendi Mohd",
                                email: "afendimohd@jkseng.com",
                                department: "After Sales & Services",
                                dob: "1998-04-30",
                                pulseOrg: {
                                    division: { id: "div-1", name: "Corporate" },
                                    department: { id: "dept-1", name: "After Sales & Services" },
                                    section: { id: "sec-1", name: "Support" }
                                }
                            }
                        },
                        selectedCatalogItemKeys: ["sigma"],
                        credentials: [
                            {
                                system: "sigma",
                                username: "afendimohd",
                                password: "Secret123",
                                templateVersion: 2
                            }
                        ],
                        supplementalCredentials: {
                            actualPassword: "Actual#123",
                            profileFields: {
                                name: "Afendi Mohd",
                                email: "afendimohd@jkseng.com",
                                date: "1998-04-30",
                                "temporary-password": "Temp#123",
                                "actual-password": "Actual#123",
                                "android-password": "Android#123",
                                "iphone-mail": "iPhone OK",
                                "ipad-mail": "iPad OK",
                                "mac-mail": "Mac OK",
                                "outlook-ios": "Outlook iOS OK",
                                "outlook-android": "Outlook Android OK",
                                "outlook-desktop": "Outlook Desktop OK",
                                "active-directory": "Afendimohd@7189",
                                status: "Active",
                                category: "Staff",
                                remarks: "Ready"
                            },
                            imap: {
                                username: "afendimohd",
                                password: "Imap#123",
                                inputs: { email: "afendimohd@jkseng.com" },
                                selectedFields: { email: true }
                            }
                        },
                        templateVersion: 2,
                        setupSheet: { entries: [{ systemId: "sigma" }] }
                    };
                },
                getUserCredentialBySystem: async () => null,
                createUserCredential: async (data) => {
                    const credential = { id: `credential-${createdCredentials.length + 1}`, ...data };
                    createdCredentials.push(credential);
                    return credential;
                },
                createCredentialVersion: async (data) => {
                    credentialVersions.push(data);
                    return { id: `version-${credentialVersions.length}`, ...data };
                },
                deletePreviewSession: async (token) => {
                    deletedPreviewToken = token;
                }
            },
            repo: {
                createOnboardingDraft: async () => {
                    draftCreated = true;
                }
            },
            profileFieldsRepo: {
                updateProfileFieldValues: async (data) => {
                    profileUpdates.push(data);
                    return [];
                }
            },
            prisma: {
                $transaction: async (callback) => callback({})
            }
        }
    );

    assert.equal(draftCreated, false);
    assert.equal(result.userId, "user-1");
    assert.equal(result.source.mode, "manual");
    assert.equal(result.source.userId, "user-1");
    assert.equal(createdUsers[0].username, "afendimohd");
    assert.equal(createdCredentials.length, 2);
    assert.equal(createdCredentials[0].userId, "user-1");
    assert.equal(createdCredentials[0].systemId, "sigma");
    assert.equal(createdCredentials[0].generatedBy, "actor-1");
    assert.equal(createdCredentials[1].systemId, "imap");
    assert.equal(createdCredentials[1].isActive, true);
    assert.equal(createdCredentials[1].password, "Imap#123");
    assert.deepEqual(profileUpdates[0], {
        userId: "user-1",
        values: {
            name: "Afendi Mohd",
            email: "afendimohd@jkseng.com",
            date: "1998-04-30",
            "temporary-password": "Temp#123",
            "actual-password": "Actual#123",
            "android-password": "Android#123",
            "iphone-mail": "iPhone OK",
            "ipad-mail": "iPad OK",
            "mac-mail": "Mac OK",
            "outlook-ios": "Outlook iOS OK",
            "outlook-android": "Outlook Android OK",
            "outlook-desktop": "Outlook Desktop OK",
            "active-directory": "Afendimohd@7189",
            status: "Active",
            category: "Staff",
            remarks: "Ready"
        },
        updatedBy: "actor-1"
    });
    assert.deepEqual(createdUsers[0].orgSnapshot, {
        source: "manual_onboarding",
        division: { id: "div-1", name: "Corporate" },
        department: { id: "dept-1", name: "After Sales & Services" },
        section: { id: "sec-1", name: "Support" }
    });
    assert.equal(credentialVersions[0].credentialId, "credential-1");
    assert.equal(credentialVersions[1].credentialId, "credential-2");
    assert.equal(deletedPreviewToken, "preview-1");
});

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

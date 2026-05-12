import test from "node:test";
import assert from "node:assert/strict";
import { listUsersFiltered, prisma } from "../../apps/api/src/features/users/repo.js";

test("listUsersFiltered builds MySQL-compatible search filters including LDAP mail", async (t) => {
    const originalCount = prisma.user.count;
    const originalFindMany = prisma.user.findMany;
    const originalTransaction = prisma.$transaction;

    let countArgs;
    let findManyArgs;

    prisma.user.count = async (args) => {
        countArgs = args;
        return 1;
    };
    prisma.user.findMany = async (args) => {
        findManyArgs = args;
        return [];
    };
    prisma.$transaction = async (operations) => Promise.all(operations);

    t.after(() => {
        prisma.user.count = originalCount;
        prisma.user.findMany = originalFindMany;
        prisma.$transaction = originalTransaction;
    });

    const search = "far";
    const result = await listUsersFiltered({ search }, { page: 1, perPage: 20 });

    assert.equal(result.total, 1);
    const { where } = countArgs;
    assert.ok(Array.isArray(where.OR));
    assert.ok(where.OR.some((clause) => clause.username?.contains === search));
    assert.ok(where.OR.some(
        (clause) => clause.ldapAttributes?.path === "$.mail" && clause.ldapAttributes.string_contains === search
    ));
    assert.ok(where.OR.some(
        (clause) => clause.ldapAttributes?.path === "$.cn" && clause.ldapAttributes.string_contains === search
    ));
    assert.ok(where.OR.some(
        (clause) => clause.imapProfile?.is?.fullName?.contains === search
    ));
    assert.deepEqual(findManyArgs.where, countArgs.where);
    assert.equal("mode" in countArgs.where.OR[0].username, false);
});

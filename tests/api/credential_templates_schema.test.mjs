
import { describe, it, after } from "node:test";
import assert from "node:assert";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";

after(async () => {
    await prisma.$disconnect();
});

describe("Credential Template Schema", () => {
    it("should have credentialTemplate model", () => {
        console.log("Prisma keys:", Object.keys(prisma));
        // Check prototype too as accessor might be there
        console.log("Prisma prototype keys:", Object.getOwnPropertyNames(Object.getPrototypeOf(prisma)));
        assert.ok(prisma.credentialTemplate, "CredentialTemplate model should exist on Prisma client");
    });
});

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../apps/api/src/shared/db/prisma.js";
import * as service from "../../apps/api/src/features/credentials/service.js";
import { createUser } from "../../apps/api/src/features/users/repo.js";

after(async () => {
    await prisma.$disconnect();
});

test("Credential Service Integration", async (t) => {
    const actor = await createUser({ username: `service-test-${randomUUID()}`, role: "it" });

    let t1;
    await t.test("createTemplate creates version 1 and active", async () => {
        t1 = await service.createTemplate(actor.id, {
            name: "T1",
            structure: { systems: ["s1"], fields: [{ name: "f1", type: "generated" }] }
        });
        assert.equal(t1.version, 1);
        assert.equal(t1.isActive, true);
    });

    await t.test("createTemplate second active deactivates first", async () => {
        const t2 = await service.createTemplate(actor.id, {
            name: "T2",
            structure: { systems: ["s1"], fields: [{ name: "f1", type: "generated" }] }
        });
        assert.equal(t2.isActive, true);

        // Check t1 is now inactive
        const t1Updated = await service.getTemplate(t1.id);
        assert.equal(t1Updated.isActive, false);
    });

    await t.test("updateTemplate increments version", async () => {
        const updated = await service.updateTemplate(actor.id, t1.id, {
            name: "T1 Updated"
        });
        assert.equal(updated.version, 2);
    });
});

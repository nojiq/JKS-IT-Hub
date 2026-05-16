import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveRoleForDepartment,
  isItDepartment
} from "../../apps/api/src/shared/auth/departmentRoleAssignment.js";

test("isItDepartment matches IT department names and codes", () => {
  assert.equal(isItDepartment({ name: "IT" }), true);
  assert.equal(isItDepartment({ code: "IT", name: "Information Technology" }), true);
  assert.equal(isItDepartment("IT Department"), true);
  assert.equal(isItDepartment("Information Technology"), true);
});

test("isItDepartment does not match unrelated departments containing it", () => {
  assert.equal(isItDepartment("Audit"), false);
  assert.equal(isItDepartment("Facilities"), false);
  assert.equal(isItDepartment({ name: "Security" }), false);
});

test("deriveRoleForDepartment promotes IT department requesters to technicians", () => {
  const role = deriveRoleForDepartment({
    currentRole: "requester",
    ldapAttributes: { Department: "IT" }
  });

  assert.equal(role, "it");
});

test("deriveRoleForDepartment keeps elevated roles when department is IT", () => {
  const role = deriveRoleForDepartment({
    currentRole: "admin",
    orgSnapshot: { department: { code: "IT", name: "IT" } }
  });

  assert.equal(role, "admin");
});

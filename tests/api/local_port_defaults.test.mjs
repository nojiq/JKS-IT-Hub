import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getAuthConfig } from "../../apps/api/src/config/authConfig.js";

const rootEnvPath = new URL("../../.env", import.meta.url);
const exampleEnvPath = new URL("../../.env.example", import.meta.url);

const authEnvDefaults = {
  LDAP_URL: "ldaps://example.com:636",
  LDAP_BASE_DN: "dc=example,dc=com",
  LDAP_BIND_DN: "cn=bind-user,dc=example,dc=com",
  LDAP_BIND_PASSWORD: "secret-password",
  LDAP_USER_FILTER: "(uid={{username}})",
  LDAP_SYNC_FILTER: "(objectClass=person)",
  LDAP_SYNC_ATTRIBUTES: "uid,mail",
  LDAP_SYNC_USERNAME_ATTRIBUTE: "uid",
  JWT_SECRET: "1234567890abcdef",
  JWT_ISSUER: "it-hub",
  JWT_AUDIENCE: "it-hub-web",
  JWT_EXPIRES_IN: "12h"
};

test("root env files define the committed local web and api ports", async () => {
  const [rootEnv, exampleEnv] = await Promise.all([
    readFile(rootEnvPath, "utf8"),
    readFile(exampleEnvPath, "utf8")
  ]);

  for (const content of [rootEnv, exampleEnv]) {
    assert.match(content, /^API_PORT=3006$/m);
    assert.match(content, /^WEB_PORT=5176$/m);
    assert.match(content, /^CORS_ORIGIN="http:\/\/localhost:5176"$/m);
    assert.match(content, /^VITE_API_BASE_URL="http:\/\/localhost:3006"$/m);
    assert.match(content, /^APP_URL=http:\/\/localhost:5176$/m);
  }
});

test("auth config falls back to the committed frontend origin", () => {
  const originalEnv = process.env;
  process.env = { ...originalEnv, ...authEnvDefaults };
  delete process.env.CORS_ORIGIN;

  assert.equal(getAuthConfig().cors.origin, "http://localhost:5176");

  process.env = originalEnv;
});

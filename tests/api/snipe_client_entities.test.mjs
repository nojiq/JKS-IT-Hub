import test from "node:test";
import assert from "node:assert/strict";

import { createSnipeClient } from "../../apps/api/src/features/assets/client.js";

test("Snipe client fetches typed entities by id", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({ id: 42, name: "Dell Dock", category: { name: "Dock" } })
    };
  };

  const client = createSnipeClient({
    config: { baseUrl: "https://assets.example.test", apiToken: "token", timeoutMs: 1000 },
    fetchImpl
  });

  const entity = await client.fetchSnipeEntity("ACCESSORY", 42);

  assert.equal(entity.id, 42);
  assert.equal(calls[0].url, "https://assets.example.test/api/v1/accessories/42");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token");
});

test("Snipe client returns null for missing typed entities", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    text: async () => "not found"
  });

  const client = createSnipeClient({
    config: { baseUrl: "https://assets.example.test", apiToken: "token", timeoutMs: 1000 },
    fetchImpl
  });

  assert.equal(await client.fetchSnipeEntity("CONSUMABLE", 99), null);
});

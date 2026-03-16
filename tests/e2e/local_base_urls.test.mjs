import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const e2eFiles = [
  new URL("./credentialExport.e2e.test.js", import.meta.url),
  new URL("./export_formats.e2e.test.js", import.meta.url),
  new URL("./batchCredentialExport.e2e.test.js", import.meta.url)
];

test("e2e suites do not hardcode the retired local ports", async () => {
  const contents = await Promise.all(e2eFiles.map((fileUrl) => readFile(fileUrl, "utf8")));

  for (const content of contents) {
    assert.doesNotMatch(content, /http:\/\/localhost:5173/);
    assert.doesNotMatch(content, /http:\/\/localhost:3001/);
  }
});

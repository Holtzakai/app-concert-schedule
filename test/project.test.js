import test from "node:test";
import assert from "node:assert/strict";
import { createSampleState } from "../src/domain/sample.js";
import { parseProjectJson, PROJECT_FORMAT, serializeProject } from "../src/domain/project.js";

test("project JSON round-trips settings and schedule items", () => {
  const source = createSampleState();
  source.settings.organization = "テスト吹奏楽部";
  source.gpOrder = [source.items[0].id];
  const restored = parseProjectJson(serializeProject(source));
  assert.equal(restored.settings.organization, "テスト吹奏楽部");
  assert.equal(restored.items.length, source.items.length);
  assert.deepEqual(restored.gpOrder, source.gpOrder);
  assert.equal(JSON.parse(serializeProject(source)).format, PROJECT_FORMAT);
});

test("project JSON rejects unrelated or incomplete data", () => {
  assert.throws(() => parseProjectJson('{"format":"other","data":{}}'), /中間データ/);
  assert.throws(() => parseProjectJson('{"format":"concert-schedule-maker","data":{}}'), /公演設定/);
});

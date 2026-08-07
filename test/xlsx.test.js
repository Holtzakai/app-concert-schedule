import test from "node:test";
import assert from "node:assert/strict";
import { createSampleState } from "../src/domain/sample.js";
import { createScheduleXlsx } from "../src/export/xlsx.js";

test("Excel export is a non-empty OOXML zip with a central directory", async () => {
  const blob = createScheduleXlsx(createSampleState());
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.ok(bytes.length > 10_000);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.ok(Buffer.from(bytes).includes(Buffer.from("xl/worksheets/sheet3.xml")));
  assert.deepEqual([...bytes.slice(12, 14)], [0x21, 0x00]);
  assert.deepEqual([...bytes.slice(-22, -18)], [0x50, 0x4b, 0x05, 0x06]);
});

test("Excel export applies the selected portrait print orientation", async () => {
  const state = createSampleState();
  state.settings.layoutOrientation = "portrait";
  const bytes = new Uint8Array(await createScheduleXlsx(state).arrayBuffer());
  assert.ok(Buffer.from(bytes).includes(Buffer.from('orientation="portrait"')));
});

test("Excel export merges special rows across the full schedule section", async () => {
  const bytes = new Uint8Array(await createScheduleXlsx(createSampleState()).arrayBuffer());
  const content = Buffer.from(bytes);
  for (const range of ["A6:H6", "A7:H7", "A11:H11", "A14:H14"]) {
    assert.ok(content.includes(Buffer.from(`<mergeCell ref="${range}"/>`)), `${range} should be merged`);
  }
  assert.ok(!content.includes(Buffer.from('<mergeCell ref="B11:H11"/>')));
});

test("Excel export preserves borders across every cell in merged schedule ranges", async () => {
  const bytes = new Uint8Array(await createScheduleXlsx(createSampleState()).arrayBuffer());
  const content = Buffer.from(bytes);
  for (const cell of [
    '<c r="E4" t="inlineStr" s="3">',
    '<c r="A5" t="inlineStr" s="3">',
    '<c r="L5" t="inlineStr" s="3">',
    '<c r="H6" t="inlineStr" s="6">',
    '<c r="H11" t="inlineStr" s="7">',
  ]) {
    assert.ok(content.includes(Buffer.from(cell)), `${cell} should retain its border style`);
  }
});

test("Excel export writes worksheet elements in SpreadsheetML schema order", async () => {
  const bytes = new Uint8Array(await createScheduleXlsx(createSampleState()).arrayBuffer());
  const content = Buffer.from(bytes).toString("utf8");
  const sheetPr = content.indexOf("<sheetPr>");
  const dimension = content.indexOf("<dimension ");
  const sheetViews = content.indexOf("<sheetViews>");
  const sheetFormat = content.indexOf("<sheetFormatPr ");
  const cols = content.indexOf("<cols>");
  const sheetData = content.indexOf("<sheetData>");
  assert.ok(sheetPr < dimension);
  assert.ok(dimension < sheetViews);
  assert.ok(sheetViews < sheetFormat);
  assert.ok(sheetFormat < cols);
  assert.ok(cols < sheetData);
});

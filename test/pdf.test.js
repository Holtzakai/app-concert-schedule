import test from "node:test";
import assert from "node:assert/strict";
import { buildPdfFromJpegs } from "../src/export/pdf.js";

test("PDF builder creates a valid one-page PDF container", async () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const blob = buildPdfFromJpegs([fakeJpeg]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 1/);
  assert.match(text, /startxref/);
  assert.ok(text.endsWith("%%EOF"));
});

test("PDF builder supports an A4 portrait media box", async () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const blob = buildPdfFromJpegs([fakeJpeg], { pageWidth: 1191, pageHeight: 1684, pdfWidth: 595.28, pdfHeight: 841.89 });
  const text = Buffer.from(await blob.arrayBuffer()).toString("latin1");
  assert.match(text, /\/MediaBox \[0 0 595\.28 841\.89\]/);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateGpSchedule,
  calculateMainSchedule,
  createItem,
  formatTime,
  ITEM_TYPES,
  parseTime,
} from "../src/domain/schedule.js";
import { createSampleState } from "../src/domain/sample.js";

test("time helpers parse and format same-day and overnight values", () => {
  assert.equal(parseTime("13:30"), 810);
  assert.equal(formatTime(810), "13:30");
  assert.equal(formatTime(1450), "翌 00:10");
});

test("main schedule accumulates durations, gaps and break buffer", () => {
  const settings = { firstStart: "13:30", tuningMinutes: 10, travelMinutes: 2 };
  const items = [
    createItem(ITEM_TYPES.PERFORMANCE, { durationMinutes: 6, prepMinutes: 2, gapAfter: 0 }),
    createItem(ITEM_TYPES.BREAK, { durationMinutes: 10, gapAfter: 1 }),
    createItem(ITEM_TYPES.PERFORMANCE, { durationMinutes: 7, prepMinutes: 3, gapAfter: 0 }),
  ];
  const schedule = calculateMainSchedule(settings, items);
  assert.deepEqual(
    schedule.map((item) => [item.start, item.end]),
    [[810, 816], [816, 826], [827, 834]],
  );
  assert.equal(schedule[0].sleeve, 808);
  assert.equal(schedule[0].tuningStart, 796);
  assert.equal(schedule[2].sequence, 2);
});

test("GP schedule uses only performances in reverse order", () => {
  const state = createSampleState();
  state.settings.gpStart = "10:00";
  const gp = calculateGpSchedule(state.settings, state.items);
  const mainNames = state.items.filter((item) => item.type === ITEM_TYPES.PERFORMANCE).map((item) => item.name);
  assert.deepEqual(gp.map((item) => item.name), mainNames.reverse());
  assert.equal(gp[0].start, 600);
});

test("GP schedule follows an independently configured performance order", () => {
  const state = createSampleState();
  const performances = state.items.filter((item) => item.type === ITEM_TYPES.PERFORMANCE);
  const customOrder = [performances[0].id, performances.at(-1).id];
  const gp = calculateGpSchedule(state.settings, state.items, customOrder);
  assert.equal(gp[0].id, performances[0].id);
  assert.equal(gp[1].id, performances.at(-1).id);
  assert.equal(gp.length, performances.length);
});

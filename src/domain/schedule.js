export const ITEM_TYPES = Object.freeze({
  PERFORMANCE: "performance",
  BREAK: "break",
  CUE: "cue",
});

export function parseTime(value) {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value)) return 0;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatTime(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return "─";
  const rounded = Math.round(totalMinutes);
  const day = Math.floor(rounded / 1440);
  const normalized = ((rounded % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${day > 0 ? `翌${day > 1 ? day : ""} ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function minutes(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

export function calculateMainSchedule(settings, sourceItems) {
  let cursor = parseTime(settings.firstStart);
  let sequence = 0;

  return sourceItems.map((source, index) => {
    const item = { ...source };
    const duration = minutes(item.durationMinutes);
    const gapAfter = minutes(item.gapAfter);

    if (item.type === ITEM_TYPES.PERFORMANCE) {
      sequence += 1;
      const start = cursor;
      const end = start + duration;
      const sleeve = start - minutes(item.prepMinutes);
      const tuningEnd = sleeve - minutes(settings.travelMinutes);
      const tuningStart = tuningEnd - minutes(settings.tuningMinutes);
      cursor = end + gapAfter;
      return { ...item, index, sequence, start, end, sleeve, tuningStart, tuningEnd };
    }

    const start = cursor;
    const end = start + duration;
    cursor = end + gapAfter;
    return { ...item, index, sequence: null, start, end };
  });
}

export function resolveGpItems(sourceItems, gpOrder = []) {
  const performances = sourceItems.filter((item) => item.type === ITEM_TYPES.PERFORMANCE);
  if (!Array.isArray(gpOrder) || gpOrder.length === 0) return [...performances].reverse();
  const byId = new Map(performances.map((item) => [item.id, item]));
  const ordered = [];
  const used = new Set();
  for (const id of gpOrder) {
    const item = byId.get(id);
    if (item && !used.has(id)) {
      ordered.push(item);
      used.add(id);
    }
  }
  const additions = performances.filter((item) => !used.has(item.id)).reverse();
  return [...ordered, ...additions];
}

export function calculateGpSchedule(settings, sourceItems, gpOrder = []) {
  let cursor = parseTime(settings.gpStart);
  return resolveGpItems(sourceItems, gpOrder)
    .map((item, index) => {
      const start = cursor;
      const end = start + minutes(item.durationMinutes);
      const sleeve = start - minutes(item.prepMinutes);
      const tuningEnd = sleeve - minutes(settings.travelMinutes);
      const tuningStart = tuningEnd - minutes(settings.tuningMinutes);
      cursor = end + minutes(item.gapAfter);
      return { ...item, index, sequence: index + 1, start, end, sleeve, tuningStart, tuningEnd };
    });
}

export function scheduleEnd(schedule, fallbackTime) {
  const last = schedule.at(-1);
  return last ? last.end + minutes(last.gapAfter) : parseTime(fallbackTime);
}

export function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createItem(type = ITEM_TYPES.PERFORMANCE, overrides = {}) {
  const common = {
    id: createId(),
    type,
    name: type === ITEM_TYPES.BREAK ? "休憩" : type === ITEM_TYPES.CUE ? "進行" : "新しい団体",
    durationMinutes: type === ITEM_TYPES.BREAK ? 10 : type === ITEM_TYPES.CUE ? 0 : 6,
    prepMinutes: type === ITEM_TYPES.PERFORMANCE ? 2 : 0,
    gapAfter: type === ITEM_TYPES.BREAK ? 1 : 0,
    room: type === ITEM_TYPES.PERFORMANCE ? "A" : "",
    stageLight: type === ITEM_TYPES.PERFORMANCE ? "明" : "暗",
    spotLight: "×",
    audienceLight: type === ITEM_TYPES.PERFORMANCE ? "暗" : "明",
    announcement:
      type === ITEM_TYPES.PERFORMANCE ? "曲紹介" : type === ITEM_TYPES.BREAK ? "休憩案内" : "",
  };
  return { ...common, ...overrides };
}

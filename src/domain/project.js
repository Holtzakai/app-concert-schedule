import { createSampleState } from "./sample.js";
import { createItem, ITEM_TYPES } from "./schedule.js";

export const PROJECT_FORMAT = "concert-schedule-maker";
export const PROJECT_VERSION = 1;

const validTypes = new Set(Object.values(ITEM_TYPES));
const numericSettings = new Set(["tuningMinutes", "travelMinutes"]);

export function serializeProject(state) {
  return JSON.stringify({
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: state.settings,
      items: state.items,
      gpOrder: state.gpOrder,
      activeView: state.activeView,
    },
  }, null, 2);
}

export function parseProjectJson(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("JSONの形式を確認できませんでした。");
  }

  if (payload?.format && payload.format !== PROJECT_FORMAT) {
    throw new Error("このアプリの中間データではありません。");
  }

  const data = payload?.data ?? payload;
  if (!data?.settings || typeof data.settings !== "object" || !Array.isArray(data.items)) {
    throw new Error("公演設定または進行データが見つかりません。");
  }

  const sample = createSampleState();
  const settings = { ...sample.settings };
  for (const key of Object.keys(settings)) {
    if (!(key in data.settings)) continue;
    settings[key] = numericSettings.has(key) ? Number(data.settings[key]) : String(data.settings[key] ?? "");
  }

  const items = data.items.map((source, index) => {
    if (!source || typeof source !== "object" || !validTypes.has(source.type)) {
      throw new Error(`${index + 1}件目の進行項目の区分が不正です。`);
    }
    return createItem(source.type, {
      ...source,
      ...(typeof source.id === "string" && source.id ? { id: source.id } : {}),
      name: String(source.name ?? ""),
      durationMinutes: Number(source.durationMinutes) || 0,
      prepMinutes: Number(source.prepMinutes) || 0,
      gapAfter: Number(source.gapAfter) || 0,
      room: String(source.room ?? ""),
      stageLight: String(source.stageLight ?? "─"),
      spotLight: String(source.spotLight ?? "─"),
      audienceLight: String(source.audienceLight ?? "─"),
      announcement: String(source.announcement ?? ""),
    });
  });

  const itemIds = new Set(items.filter((item) => item.type === ITEM_TYPES.PERFORMANCE).map((item) => item.id));
  const gpOrder = Array.isArray(data.gpOrder)
    ? data.gpOrder.filter((id) => typeof id === "string" && itemIds.has(id))
    : [];

  return {
    schemaVersion: 2,
    settings,
    items,
    gpOrder,
    activeView: data.activeView === "gp" ? "gp" : "main",
  };
}
